import { useState } from "react";
import onenoteLogo from "@/assets/onenote-logo.png";

interface HomeProps {
  onAccessGame: () => void;
}

const Home = ({ onAccessGame }: HomeProps) => {
  const [text, setText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim().toLowerCase().includes("minecraft")) {
      onAccessGame();
    } else {
      setText("");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-purple-50 to-pink-50 flex flex-col items-center justify-center gap-8 p-4">
      <img src={onenoteLogo} alt="OneNote Logo" className="w-32 h-32 drop-shadow-xl" />
      <h1 className="text-3xl font-bold text-purple-800">OneNote Online</h1>
      <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-md">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Tapez quelque chose..."
          className="flex-1 h-11 rounded-xl border border-purple-200 bg-white/80 px-4 text-base text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
        />
        <button
          type="submit"
          className="h-11 px-6 rounded-xl bg-purple-600 text-white font-medium hover:bg-purple-700 transition-colors shadow-sm"
        >
          Valider
        </button>
      </form>
    </div>
  );
};

export default Home;
