import type { Metadata } from "next";
import GameDemoClient from "./GameDemoClient";

export const metadata: Metadata = {
  title: "断界 · 横版动作格斗 Demo",
  description: "图片资源驱动的横版动作格斗云端 Demo",
};

export default function GameDemoPage() {
  return <GameDemoClient />;
}