import Game from './components/Game.tsx';
import { ToastContainer } from 'react-toastify';

export default function Home() {
  return (
    <main className="relative h-full min-h-screen w-full font-body bg-gray-900 flex flex-col">
      <Game />
      <ToastContainer position="bottom-right" autoClose={2000} closeOnClick theme="dark" />
    </main>
  );
}
