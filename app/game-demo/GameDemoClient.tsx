"use client";

import { useEffect, useRef, useState } from "react";
import { GAME_ATLAS, ATLAS } from "./assets/atlas";

type EngineApi = {
  reset: () => void;
  cycleScene: () => void;
  setPaused: (value: boolean) => void;
};

type EnemyType = "guard" | "beast";

type Enemy = {
  id: number;
  type: EnemyType;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  dir: 1 | -1;
  hp: number;
  maxHp: number;
  onGround: boolean;
  state: "idle" | "run" | "attack" | "hurt" | "death" | "windup";
  stateTime: number;
  attackCd: number;
  windup: number;
  hitTime: number;
  deathTime: number;
  dead: boolean;
};

type HitBox = {
  owner: "player" | number;
  x: number;
  y: number;
  w: number;
  h: number;
  dir: 1 | -1;
  life: number;
  damage: number;
  heavy: boolean;
  hit: Set<number | "player">;
};

type Fx = {
  kind: "slash" | "hit" | "skill";
  x: number;
  y: number;
  life: number;
  max: number;
  dir: 1 | -1;
  scale: number;
};

type Projectile = {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  dir: 1 | -1;
  life: number;
  damage: number;
  hit: Set<number>;
};

const SCENES = [
  { key: "city", name: "废都月夜" },
  { key: "forest", name: "遗迹森林" },
  { key: "temple", name: "古老圣殿" },
  { key: "red", name: "赤红终焉" },
] as const;

const FRAME_COUNTS = {
  player: {
    idle: 4,
    run: 4,
    jump: 4,
    attack1: 4,
    attack2: 4,
    attack3: 4,
    dash: 4,
    hurt: 4,
    death: 4,
  },
  guard: { idle: 4, run: 4, attack: 4, hurt: 3, death: 4 },
  beast: { idle: 4, run: 4, attack: 4, hurt: 4, death: 4 },
} as const;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

export default function GameDemoClient() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<EngineApi | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [sceneName, setSceneName] = useState(SCENES[0].name);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 960;
    const H = 540;
    canvas.width = W;
    canvas.height = H;

    let disposed = false;
    let raf = 0;
    let last = performance.now();
    let time = 0;
    let sceneIndex = 0;
    let isPaused = false;
    let shake = 0;
    let hitStop = 0;
    let nextEnemyId = 1;

    const keys = new Set<string>();
    const attacks: HitBox[] = [];
    const projectiles: Projectile[] = [];
    const effects: Fx[] = [];
    const ghosts: { x: number; y: number; dir: 1 | -1; life: number; max: number }[] = [];

    const platforms = [
      { x: 0, y: 468, w: 960, h: 72 },
      { x: 130, y: 376, w: 190, h: 28 },
      { x: 410, y: 322, w: 165, h: 28 },
      { x: 675, y: 388, w: 195, h: 28 },
    ];

    const player = {
      x: 82,
      y: 380,
      w: 42,
      h: 74,
      vx: 0,
      vy: 0,
      dir: 1 as 1 | -1,
      hp: 100,
      maxHp: 100,
      onGround: false,
      jumps: 0,
      state: "idle",
      stateTime: 0,
      combo: 0,
      comboTimer: 0,
      attackLock: 0,
      dashTime: 0,
      dashCd: 0,
      skillCd: 0,
      inv: 0,
      dead: false,
    };

    let enemies: Enemy[] = [];

    let atlasImage: HTMLImageElement | null = null;


    const overlap = (
      a: { x: number; y: number; w: number; h: number },
      b: { x: number; y: number; w: number; h: number },
    ) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

    function setPlayerState(state: string) {
      if (player.state !== state) {
        player.state = state;
        player.stateTime = 0;
      }
    }

    function setEnemyState(enemy: Enemy, state: Enemy["state"]) {
      if (enemy.state !== state) {
        enemy.state = state;
        enemy.stateTime = 0;
      }
    }

    function spawnEnemy(type: EnemyType, x: number, y: number): Enemy {
      const beast = type === "beast";
      return {
        id: nextEnemyId++,
        type,
        x,
        y,
        w: beast ? 72 : 48,
        h: beast ? 48 : 72,
        vx: 0,
        vy: 0,
        dir: -1,
        hp: beast ? 125 : 90,
        maxHp: beast ? 125 : 90,
        onGround: false,
        state: "idle",
        stateTime: 0,
        attackCd: 0.5,
        windup: 0,
        hitTime: 0,
        deathTime: 0,
        dead: false,
      };
    }

    function respawnEnemies() {
      nextEnemyId = 1;
      enemies = [
        spawnEnemy("guard", 520, 396),
        spawnEnemy("beast", 735, 420),
        spawnEnemy("guard", 850, 396),
      ];
    }

    function resolveGround(entity: {
      x: number;
      y: number;
      w: number;
      h: number;
      vy: number;
      onGround: boolean;
    }, oldY: number) {
      entity.onGround = false;
      for (const p of platforms) {
        if (
          entity.x + entity.w > p.x &&
          entity.x < p.x + p.w &&
          entity.vy >= 0 &&
          oldY + entity.h <= p.y + 10 &&
          entity.y + entity.h >= p.y
        ) {
          entity.y = p.y - entity.h;
          entity.vy = 0;
          entity.onGround = true;
          if (entity === player) player.jumps = 0;
        }
      }
    }

    function reset() {
      Object.assign(player, {
        x: 82,
        y: 380,
        vx: 0,
        vy: 0,
        dir: 1,
        hp: 100,
        onGround: false,
        jumps: 0,
        state: "idle",
        stateTime: 0,
        combo: 0,
        comboTimer: 0,
        attackLock: 0,
        dashTime: 0,
        dashCd: 0,
        skillCd: 0,
        inv: 0,
        dead: false,
      });
      attacks.length = 0;
      projectiles.length = 0;
      effects.length = 0;
      ghosts.length = 0;
      shake = 0;
      hitStop = 0;
      respawnEnemies();
      canvas.focus();
    }

    function cycleScene() {
      sceneIndex = (sceneIndex + 1) % SCENES.length;
      setSceneName(SCENES[sceneIndex].name);
      canvas.focus();
    }

    function jump() {
      if (player.dead || player.attackLock > 0.28) return;
      if (player.onGround || player.jumps < 2) {
        player.vy = -610;
        player.onGround = false;
        player.jumps += 1;
        setPlayerState("jump");
      }
    }

    function dash() {
      if (player.dead || player.dashCd > 0) return;
      player.dashTime = 0.18;
      player.dashCd = 0.55;
      player.inv = Math.max(player.inv, 0.22);
      player.vy = 0;
      player.vx = player.dir * 820;
      player.attackLock = 0.16;
      setPlayerState("dash");
    }

    function normalAttack() {
      if (player.dead || player.attackLock > 0) return;

      if (!player.onGround) {
        player.attackLock = 0.3;
        setPlayerState("attack2");
        attacks.push({
          owner: "player",
          x: player.dir > 0 ? player.x + 30 : player.x - 80,
          y: player.y + 8,
          w: 90,
          h: 64,
          dir: player.dir,
          life: 0.13,
          damage: 24,
          heavy: false,
          hit: new Set(),
        });
        effects.push({
          kind: "slash",
          x: player.x + player.w / 2,
          y: player.y + 30,
          life: 0.16,
          max: 0.16,
          dir: player.dir,
          scale: 0.7,
        });
        return;
      }

      player.combo = player.comboTimer > 0 ? (player.combo % 3) + 1 : 1;
      player.comboTimer = 0.48;
      const c = player.combo;
      player.attackLock = c === 3 ? 0.34 : 0.24;
      setPlayerState(`attack${c}`);

      const reach = c === 3 ? 116 : 84;
      attacks.push({
        owner: "player",
        x: player.dir > 0 ? player.x + 28 : player.x - reach + 10,
        y: player.y + 8,
        w: reach,
        h: 58,
        dir: player.dir,
        life: c === 3 ? 0.16 : 0.12,
        damage: c === 3 ? 32 : 18,
        heavy: c === 3,
        hit: new Set(),
      });
      effects.push({
        kind: "slash",
        x: player.x + player.w / 2 + player.dir * 30,
        y: player.y + 30,
        life: c === 3 ? 0.2 : 0.14,
        max: c === 3 ? 0.2 : 0.14,
        dir: player.dir,
        scale: c === 3 ? 1.15 : 0.75,
      });
      player.vx += player.dir * (c === 3 ? 110 : 45);
    }

    function heavyAttack() {
      if (player.dead || player.attackLock > 0 || !player.onGround) return;
      player.combo = 0;
      player.attackLock = 0.5;
      setPlayerState("attack3");
      attacks.push({
        owner: "player",
        x: player.dir > 0 ? player.x + 26 : player.x - 138 + 10,
        y: player.y - 4,
        w: 138,
        h: 72,
        dir: player.dir,
        life: 0.2,
        damage: 46,
        heavy: true,
        hit: new Set(),
      });
      effects.push({
        kind: "slash",
        x: player.x + player.w / 2 + player.dir * 40,
        y: player.y + 25,
        life: 0.24,
        max: 0.24,
        dir: player.dir,
        scale: 1.45,
      });
      player.vx += player.dir * 130;
    }

    function skill() {
      if (player.dead || player.skillCd > 0 || player.attackLock > 0) return;
      player.skillCd = 1.25;
      player.attackLock = 0.28;
      setPlayerState("attack2");
      projectiles.push({
        x: player.dir > 0 ? player.x + 38 : player.x - 70,
        y: player.y + 22,
        w: 76,
        h: 34,
        vx: player.dir * 660,
        dir: player.dir,
        life: 1.25,
        damage: 28,
        hit: new Set(),
      });
    }

    function hurtPlayer(amount: number, dir: 1 | -1) {
      if (player.inv > 0 || player.dead) return;
      player.hp -= amount;
      player.inv = 0.72;
      player.attackLock = 0.3;
      player.vx = dir * 290;
      player.vy = -260;
      setPlayerState("hurt");
      shake = 10;
      hitStop = 0.05;
      effects.push({
        kind: "hit",
        x: player.x + player.w / 2,
        y: player.y + player.h / 2,
        life: 0.16,
        max: 0.16,
        dir: -dir,
        scale: 0.55,
      });
      if (player.hp <= 0) {
        player.hp = 0;
        player.dead = true;
        setPlayerState("death");
      }
    }

    function hurtEnemy(enemy: Enemy, amount: number, dir: 1 | -1, heavy: boolean) {
      if (enemy.dead) return;
      enemy.hp -= amount;
      enemy.hitTime = heavy ? 0.25 : 0.17;
      enemy.vx += dir * (heavy ? 530 : 330);
      enemy.vy = -150;
      setEnemyState(enemy, "hurt");
      shake = heavy ? 12 : 6;
      hitStop = heavy ? 0.07 : 0.035;
      effects.push({
        kind: "hit",
        x: enemy.x + enemy.w / 2,
        y: enemy.y + enemy.h / 2,
        life: 0.17,
        max: 0.17,
        dir,
        scale: heavy ? 0.8 : 0.55,
      });
      if (enemy.hp <= 0) {
        enemy.hp = 0;
        enemy.dead = true;
        enemy.deathTime = 0.7;
        setEnemyState(enemy, "death");
      }
    }

    function updatePlayer(dt: number) {
      player.stateTime += dt;
      player.inv = Math.max(0, player.inv - dt);
      player.attackLock = Math.max(0, player.attackLock - dt);
      player.comboTimer = Math.max(0, player.comboTimer - dt);
      player.dashTime = Math.max(0, player.dashTime - dt);
      player.dashCd = Math.max(0, player.dashCd - dt);
      player.skillCd = Math.max(0, player.skillCd - dt);
      if (player.comboTimer <= 0) player.combo = 0;

      if (player.dead) {
        player.vy += 1500 * dt;
        const oldY = player.y;
        player.y += player.vy * dt;
        resolveGround(player, oldY);
        return;
      }

      const left = keys.has("a") || keys.has("arrowleft");
      const right = keys.has("d") || keys.has("arrowright");
      const move = (right ? 1 : 0) - (left ? 1 : 0);

      if (player.dashTime > 0) {
        player.vy = 0;
        ghosts.push({
          x: player.x,
          y: player.y,
          dir: player.dir,
          life: 0.18,
          max: 0.18,
        });
      } else {
        if (player.attackLock <= 0.1) {
          const target = move * 330;
          player.vx += (target - player.vx) * Math.min(1, dt * 12);
          if (move !== 0) player.dir = move > 0 ? 1 : -1;
        } else {
          player.vx *= Math.max(0.9, 1 - dt * 3);
        }
        player.vy += 1600 * dt;
      }

      const oldY = player.y;
      player.x += player.vx * dt;
      player.y += player.vy * dt;
      player.x = Math.max(0, Math.min(W - player.w, player.x));
      resolveGround(player, oldY);

      if (player.attackLock <= 0 && player.dashTime <= 0) {
        if (!player.onGround) setPlayerState("jump");
        else if (Math.abs(player.vx) > 45) setPlayerState("run");
        else setPlayerState("idle");
      }

      if (player.y > H + 100) hurtPlayer(999, 1);
    }

    function updateEnemies(dt: number) {
      for (const enemy of enemies) {
        enemy.stateTime += dt;
        enemy.attackCd = Math.max(0, enemy.attackCd - dt);
        enemy.windup = Math.max(0, enemy.windup - dt);
        enemy.hitTime = Math.max(0, enemy.hitTime - dt);

        if (enemy.dead) {
          enemy.deathTime = Math.max(0, enemy.deathTime - dt);
          continue;
        }

        const dx = player.x + player.w / 2 - (enemy.x + enemy.w / 2);
        const dist = Math.abs(dx);
        enemy.dir = dx >= 0 ? 1 : -1;

        if (enemy.state === "windup") {
          enemy.vx *= 0.78;
          if (enemy.windup <= 0) {
            setEnemyState(enemy, "attack");
            enemy.attackCd = enemy.type === "beast" ? 1.25 : 1.05;
            const reach = enemy.type === "beast" ? 96 : 70;
            attacks.push({
              owner: enemy.id,
              x: enemy.dir > 0 ? enemy.x + enemy.w - 4 : enemy.x - reach + 4,
              y: enemy.y + 5,
              w: reach,
              h: enemy.h - 8,
              dir: enemy.dir,
              life: 0.15,
              damage: enemy.type === "beast" ? 21 : 15,
              heavy: enemy.type === "beast",
              hit: new Set(),
            });
          }
        } else if (enemy.hitTime <= 0 && enemy.state !== "attack") {
          const reach = enemy.type === "beast" ? 100 : 76;
          if (dist < reach && enemy.attackCd <= 0) {
            setEnemyState(enemy, "windup");
            enemy.windup = enemy.type === "beast" ? 0.42 : 0.34;
          } else if (dist < 440 && dist > reach) {
            setEnemyState(enemy, "run");
            const speed = enemy.type === "beast" ? 150 : 104;
            enemy.vx += (enemy.dir * speed - enemy.vx) * Math.min(1, dt * 5);
          } else {
            setEnemyState(enemy, "idle");
            enemy.vx *= Math.max(0, 1 - dt * 6);
          }
        }

        if (enemy.state === "attack" && enemy.stateTime > 0.33) {
          setEnemyState(enemy, "idle");
        }

        enemy.vy += 1500 * dt;
        const oldY = enemy.y;
        enemy.x += enemy.vx * dt;
        enemy.y += enemy.vy * dt;
        enemy.x = Math.max(0, Math.min(W - enemy.w, enemy.x));
        resolveGround(enemy, oldY);
      }
    }

    function updateCombat(dt: number) {
      for (const box of attacks) {
        box.life -= dt;
        if (box.owner === "player") {
          for (const enemy of enemies) {
            if (!enemy.dead && !box.hit.has(enemy.id) && overlap(box, enemy)) {
              box.hit.add(enemy.id);
              hurtEnemy(enemy, box.damage, box.dir, box.heavy);
            }
          }
        } else if (!box.hit.has("player") && !player.dead && overlap(box, player)) {
          box.hit.add("player");
          hurtPlayer(box.damage, box.dir);
        }
      }

      for (let i = attacks.length - 1; i >= 0; i -= 1) {
        if (attacks[i].life <= 0) attacks.splice(i, 1);
      }

      for (const projectile of projectiles) {
        projectile.life -= dt;
        projectile.x += projectile.vx * dt;
        for (const enemy of enemies) {
          if (!enemy.dead && !projectile.hit.has(enemy.id) && overlap(projectile, enemy)) {
            projectile.hit.add(enemy.id);
            hurtEnemy(enemy, projectile.damage, projectile.dir, false);
          }
        }
      }

      for (let i = projectiles.length - 1; i >= 0; i -= 1) {
        const p = projectiles[i];
        if (p.life <= 0 || p.x < -120 || p.x > W + 120) projectiles.splice(i, 1);
      }
    }

    function updateFx(dt: number) {
      for (const fx of effects) fx.life -= dt;
      for (let i = effects.length - 1; i >= 0; i -= 1) {
        if (effects[i].life <= 0) effects.splice(i, 1);
      }
      for (const ghost of ghosts) ghost.life -= dt;
      for (let i = ghosts.length - 1; i >= 0; i -= 1) {
        if (ghosts[i].life <= 0) ghosts.splice(i, 1);
      }
    }

    function update(dt: number) {
      if (hitStop > 0) {
        hitStop -= dt;
        updateFx(dt * 0.25);
        return;
      }
      time += dt;
      updatePlayer(dt);
      updateEnemies(dt);
      updateCombat(dt);
      updateFx(dt);
    }

    function drawRegion(
      key: keyof typeof ATLAS,
      x: number,
      y: number,
      w: number,
      h: number,
      flip = false,
      alpha = 1,
    ) {
      if (!atlasImage) return;
      const r = ATLAS[key];
      ctx.save();
      ctx.globalAlpha = alpha;
      if (flip) {
        ctx.translate(x + w, y);
        ctx.scale(-1, 1);
        ctx.drawImage(atlasImage, r.x, r.y, r.w, r.h, 0, 0, w, h);
      } else {
        ctx.drawImage(atlasImage, r.x, r.y, r.w, r.h, x, y, w, h);
      }
      ctx.restore();
    }

    function drawStrip(
      key: keyof typeof ATLAS,
      frameCount: number,
      frame: number,
      x: number,
      y: number,
      w: number,
      h: number,
      flip: boolean,
      alpha = 1,
    ) {
      if (!atlasImage) return;
      const r = ATLAS[key];
      const frameWidth = r.w / frameCount;
      const sourceX = r.x + Math.floor(frame % frameCount) * frameWidth;
      ctx.save();
      ctx.globalAlpha = alpha;
      if (flip) {
        ctx.translate(x + w, y);
        ctx.scale(-1, 1);
        ctx.drawImage(atlasImage, sourceX, r.y, frameWidth, r.h, 0, 0, w, h);
      } else {
        ctx.drawImage(atlasImage, sourceX, r.y, frameWidth, r.h, x, y, w, h);
      }
      ctx.restore();
    }

    function playerVisualState() {
      if (player.state === "run") return "run";
      if (player.state === "jump") return "jump";
      if (player.state === "dash") return "dash";
      if (player.state === "attack1") return "attack1";
      if (player.state === "attack2") return "attack2";
      if (player.state === "attack3") return "attack3";
      if (player.state === "heavy") return "attack3";
      if (player.state === "airAttack") return "attack2";
      if (player.state === "skill") return "attack1";
      if (player.state === "fall" || player.state === "air" || player.state === "doubleJump") return "jump";
      if (player.state === "hurt") return "hurt";
      if (player.state === "death") return "death";
      return "idle";
    }

    function drawBackground() {
      const key = `bg_${SCENES[sceneIndex].key}` as keyof typeof ATLAS;
      drawRegion(key, 0, 0, W, H);

      const vignette = ctx.createLinearGradient(0, 0, 0, H);
      vignette.addColorStop(0, "rgba(0,0,0,0.08)");
      vignette.addColorStop(0.62, "rgba(0,0,0,0.05)");
      vignette.addColorStop(1, "rgba(0,0,0,0.42)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, W, H);
    }

    function drawPlatforms() {
      for (const p of platforms) {
        drawRegion("platform", p.x, p.y - 24, p.w, Math.max(60, p.h + 45), false, 0.98);
      }
    }

    function drawPlayer() {
      const visual = playerVisualState() as keyof typeof FRAME_COUNTS.player;
      const assetKey = `player_${visual}` as keyof typeof ATLAS;
      const count = FRAME_COUNTS.player[visual];
      const speed = visual.startsWith("attack") ? 15 : visual === "run" ? 12 : 8;
      const frame = Math.floor(player.stateTime * speed);
      const drawW = visual.startsWith("attack") || visual === "dash" ? 132 : 110;
      const drawH = 110;
      const dx = player.x + player.w / 2 - drawW / 2;
      const dy = player.y + player.h - drawH + 12;

      for (const ghost of ghosts) {
        drawStrip(
          "player_dash",
          FRAME_COUNTS.player.dash,
          Math.floor(time * 16),
          ghost.x - 36,
          ghost.y - 20,
          116,
          110,
          ghost.dir < 0,
          Math.max(0, (ghost.life / ghost.max) * 0.28),
        );
      }

      const blink = player.inv > 0 && Math.floor(time * 22) % 2 === 0;
      if (!blink || player.dead) {
        drawStrip(assetKey, count, frame, dx, dy, drawW, drawH, player.dir < 0, 1);
      }
    }

    function drawEnemy(enemy: Enemy) {
      if (enemy.dead && enemy.deathTime <= 0) return;

      let state = enemy.state;
      if (state === "windup") state = "idle";
      if (state !== "idle" && state !== "run" && state !== "attack" && state !== "hurt" && state !== "death") {
        state = "idle";
      }

      const key = `${enemy.type}_${state}` as keyof typeof ATLAS;
      const count = enemy.type === "guard"
        ? (FRAME_COUNTS.guard[state as keyof typeof FRAME_COUNTS.guard] ?? 4)
        : (FRAME_COUNTS.beast[state as keyof typeof FRAME_COUNTS.beast] ?? 4);
      const speed = state === "attack" ? 13 : state === "run" ? 11 : 8;
      const frame = Math.floor(enemy.stateTime * speed);
      const drawW = enemy.type === "beast" ? 142 : 120;
      const drawH = enemy.type === "beast" ? 105 : 120;
      const dx = enemy.x + enemy.w / 2 - drawW / 2;
      const dy = enemy.y + enemy.h - drawH + 12;
      const alpha = enemy.dead ? Math.max(0, enemy.deathTime / 0.7) : 1;

      drawStrip(key, count, frame, dx, dy, drawW, drawH, enemy.dir < 0, alpha);

      if (!enemy.dead) {
        const barW = enemy.type === "beast" ? 70 : 54;
        const barX = enemy.x + enemy.w / 2 - barW / 2;
        ctx.fillStyle = "rgba(6,8,12,.75)";
        ctx.fillRect(barX, enemy.y - 11, barW, 5);
        ctx.fillStyle = enemy.type === "beast" ? "#ff6a4c" : "#da574d";
        ctx.fillRect(barX, enemy.y - 11, barW * (enemy.hp / enemy.maxHp), 5);
      }

      if (enemy.state === "windup") {
        ctx.save();
        ctx.globalAlpha = 0.7 + Math.sin(time * 24) * 0.2;
        ctx.strokeStyle = "#ff765e";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, 24, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    function drawFx() {
      for (const fx of effects) {
        const alpha = Math.max(0, fx.life / fx.max);
        const assetKey = `fx_${fx.kind}` as keyof typeof ATLAS;
        const base = fx.kind === "hit" ? 86 : fx.kind === "skill" ? 105 : 150;
        const w = base * fx.scale;
        const h = base * 0.55 * fx.scale;
        drawRegion(assetKey, fx.x - w / 2, fx.y - h / 2, w, h, fx.dir < 0, alpha);
      }

      for (const p of projectiles) {
        const w = 105;
        const h = 45;
        drawRegion(
          "fx_slash",
          p.x + p.w / 2 - w / 2,
          p.y + p.h / 2 - h / 2,
          w,
          h,
          p.dir < 0,
          Math.min(1, p.life * 2),
        );
      }
    }

    function drawHud() {
      drawRegion("hud", 16, 14, 260, 154, false, 0.96);

      ctx.fillStyle = "rgba(5,10,14,.82)";
      ctx.fillRect(73, 52, 150, 11);
      ctx.fillStyle = "#72e2df";
      ctx.fillRect(73, 52, 150 * (player.hp / player.maxHp), 11);

      ctx.font = "700 13px system-ui";
      ctx.fillStyle = "#e7f4f5";
      ctx.fillText(`HP ${player.hp}/${player.maxHp}`, 73, 80);

      ctx.font = "12px system-ui";
      ctx.fillStyle = player.skillCd <= 0 ? "#8df7ef" : "#9caeb3";
      ctx.fillText(player.skillCd <= 0 ? "Q 剑气 READY" : `Q 剑气 ${player.skillCd.toFixed(1)}s`, 73, 99);

      ctx.fillStyle = "rgba(4,8,12,.64)";
      ctx.fillRect(W - 176, 18, 158, 48);
      ctx.fillStyle = "#edf7f7";
      ctx.font = "700 14px system-ui";
      ctx.fillText(SCENES[sceneIndex].name, W - 160, 39);
      ctx.fillStyle = "#a9bec3";
      ctx.font = "12px system-ui";
      ctx.fillText(`敌人 ${enemies.filter((e) => !e.dead).length}`, W - 160, 57);
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const sx = shake > 0 ? (Math.random() - 0.5) * shake : 0;
      const sy = shake > 0 ? (Math.random() - 0.5) * shake : 0;
      shake *= 0.82;

      ctx.save();
      ctx.translate(sx, sy);
      drawBackground();
      drawPlatforms();
      for (const enemy of enemies) drawEnemy(enemy);
      drawPlayer();
      drawFx();
      drawHud();
      ctx.restore();

    }

    function frame(now: number) {
      if (disposed) return;
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      if (!isPaused) update(dt);
      draw();
      raf = requestAnimationFrame(frame);
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      keys.add(key);
      if ([" ", "arrowleft", "arrowright", "arrowup"].includes(key)) event.preventDefault();
      if ((key === "w" || key === " " || key === "arrowup") && !event.repeat) jump();
      if (key === "j" && !event.repeat) normalAttack();
      if (key === "l" && !event.repeat) heavyAttack();
      if (key === "k" && !event.repeat) dash();
      if (key === "q" && !event.repeat) skill();
      if (key === "r" && !event.repeat) reset();
    };

    const onKeyUp = (event: KeyboardEvent) => {
      keys.delete(event.key.toLowerCase());
    };

    const onPointerDown = () => canvas.focus();

    loadImage(GAME_ATLAS)
      .then((image) => {
        if (disposed) return;
        atlasImage = image;
        reset();
        setLoaded(true);
        last = performance.now();
        raf = requestAnimationFrame(frame);
      })
      .catch((error) => {
        console.error("[game-demo] atlas load failed", error);
      });

    canvas.addEventListener("keydown", onKeyDown);
    canvas.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("pointerdown", onPointerDown);

    engineRef.current = {
      reset,
      cycleScene,
      setPaused(value) {
        isPaused = value;
      },
    };

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      canvas.removeEventListener("keydown", onKeyDown);
      canvas.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("pointerdown", onPointerDown);
      engineRef.current = null;
    };
  }, []);

  const togglePause = () => {
    const next = !paused;
    setPaused(next);
    engineRef.current?.setPaused(next);
    canvasRef.current?.focus();
  };

  return (
    <main className="min-h-screen bg-[#071016] px-4 py-5 text-slate-100 md:px-8">
      <section className="mx-auto max-w-[1180px]">
        <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-200/60">BROKEN REALM · CLOUD DEMO</p>
            <h1 className="mt-1 text-2xl font-semibold text-white md:text-3xl">横版动作格斗 Demo · 图像资源版</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              角色、怪物、场景、平台、HUD 与战斗特效均由图片资源驱动。当前用于验证移动、连击、受击、死亡与场景切换。
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <button
              type="button"
              onClick={() => engineRef.current?.cycleScene()}
              className="rounded-lg border border-cyan-300/20 bg-slate-900/70 px-4 py-2 text-cyan-100 hover:bg-slate-800"
            >
              场景：{sceneName}
            </button>
            <button
              type="button"
              onClick={togglePause}
              className="rounded-lg border border-slate-600 bg-slate-900/70 px-4 py-2 hover:bg-slate-800"
            >
              {paused ? "继续" : "暂停"}
            </button>
            <button
              type="button"
              onClick={() => engineRef.current?.reset()}
              className="rounded-lg border border-cyan-300/30 bg-cyan-950/60 px-4 py-2 text-cyan-100 hover:bg-cyan-900/60"
            >
              重新开始
            </button>
          </div>
        </header>

        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl shadow-cyan-950/20">
          <canvas
            ref={canvasRef}
            tabIndex={0}
            aria-label="横版动作格斗游戏 Demo"
            className="block aspect-video w-full outline-none"
          />
          {!loaded && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/60 text-sm text-cyan-100">
              正在加载游戏图片资源…
            </div>
          )}
          <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-md bg-black/45 px-3 py-1.5 text-center text-xs text-slate-200 backdrop-blur-sm">
            点击游戏画面后：A/D 移动 · W/Space 跳跃 · J 三段普攻 · L 重斩 · K 冲刺 · Q 剑气 · R 重开
          </div>
        </div>
