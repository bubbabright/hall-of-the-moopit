import { Hall } from "@/components/Hall";
import { GAMES } from "@/lib/games";

export default function Page() {
  return <Hall games={GAMES} />;
}
