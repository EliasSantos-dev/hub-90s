import { GamesTable } from '@/components/admin/GamesTable'
import { listGames } from '@/lib/admin/games'

export default async function AdminGamesPage() {
  const games = await listGames()
  return (
    <div className="space-y-6 p-6">
      <h1 className="font-display text-4xl text-[#f0df5a] tracking-widest">GAMES</h1>
      <GamesTable initialGames={games} />
    </div>
  )
}
