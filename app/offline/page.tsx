export default function OfflinePage() {
  return (
    <main className="min-h-dvh bg-background px-5 py-10 text-on-background">
      <div className="mx-auto max-w-md rounded-[28px] bg-surface-container-low p-6 shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-on-surface">Sem conexão</h1>
        <p className="mt-3 text-sm leading-6 text-on-surface-variant">
          Amado está aberto no modo PWA, mas é necessário internet para geração, RSS e histórico. Verifique a conexão e atualize a página.
        </p>
        <a href="/generate" className="mt-5 inline-flex rounded-full bg-primary px-5 py-3 text-sm font-semibold text-on-primary no-underline">
          Voltar para geração
        </a>
      </div>
    </main>
  )
}
