import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { decisionRoundsApi, type DecisionRound } from '../lib/decide'

// Shows the group's current decision round: the proposed restaurant, who
// voted how, and the viewer's own vote buttons.
export function DecisionRoundCard({
  round,
  onUpdate,
}: {
  round: DecisionRound
  onUpdate: (round: DecisionRound | null) => void
}) {
  const { user } = useAuth()
  const isCreator = user?.id === round.createdByUserId
  const yes = round.votes.filter((v) => v.vote).length
  const no = round.votes.length - yes

  async function vote(v: boolean) {
    onUpdate(await decisionRoundsApi.vote(round.id, v))
  }

  async function close() {
    onUpdate(await decisionRoundsApi.close(round.id))
  }

  const settled = round.status !== 'OPEN'

  return (
    <section
      className={`rounded-lg border-2 p-4 ${
        round.status === 'ACCEPTED'
          ? 'border-green-600 bg-green-50'
          : round.status === 'REJECTED'
            ? 'border-red-300 bg-red-50'
            : 'border-amber-400 bg-amber-50'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {settled
              ? round.status === 'ACCEPTED'
                ? 'Gruppe hat entschieden ✓'
                : 'Vorschlag abgelehnt'
              : 'Gruppenabstimmung läuft'}
          </p>
          <Link
            to={`/restaurants/${round.restaurant.id}`}
            className="text-lg font-semibold text-slate-900 hover:underline"
          >
            {round.restaurant.name}
          </Link>
          {round.restaurant.address && (
            <p className="text-xs text-slate-500">{round.restaurant.address}</p>
          )}
        </div>
        <div className="text-right text-sm">
          <span className="font-medium text-green-700">{yes} 👍</span>
          {' · '}
          <span className="font-medium text-red-600">{no} 👎</span>
          <p className="text-xs text-slate-400">
            {round.votes.length}/{round.memberCount} Stimmen
          </p>
        </div>
      </div>

      {round.votes.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          {round.votes.map((v) => `${v.name} ${v.vote ? '👍' : '👎'}`).join(' · ')}
        </p>
      )}

      {!settled && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => vote(true)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              round.myVote === true
                ? 'bg-green-700 text-white'
                : 'border border-green-700 text-green-700 hover:bg-green-100'
            }`}
          >
            👍 Bin dabei
          </button>
          <button
            onClick={() => vote(false)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              round.myVote === false
                ? 'bg-red-600 text-white'
                : 'border border-red-500 text-red-600 hover:bg-red-50'
            }`}
          >
            👎 Lieber nicht
          </button>
          {isCreator && (
            <button
              onClick={close}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
              title="Abstimmung beenden — Mehrheit der abgegebenen Stimmen entscheidet"
            >
              Abstimmung beenden
            </button>
          )}
        </div>
      )}

      {settled && round.status === 'ACCEPTED' && round.restaurant.googleMapsLink && (
        <a
          href={round.restaurant.googleMapsLink}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-block rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
        >
          In Google Maps öffnen
        </a>
      )}
    </section>
  )
}
