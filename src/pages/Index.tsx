import { useState } from "react";
import Home from "./Home";
import { MinecraftGame } from "@/components/game/MinecraftGame";

const Index = () => {
  const [showGame, setShowGame] = useState(false);

  if (showGame) {
    return <MinecraftGame />;
  }

  return <Home onAccessGame={() => setShowGame(true)} />;
};

export default Index;
