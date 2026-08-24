import Link from 'next/link'

export default function OfflinePage() {
  return (
    <main className="aug-offline">
      <section className="aug-offline__card">
        <div className="aug-offline__signal">a</div>
        <span className="aug-eyebrow mt-5 inline-block">Приложение Amado</span>
        <h1 className="mt-2 text-3xl font-extrabold tracking-[-.045em]">Сейчас нет сети</h1>
        <p className="mt-3 text-sm leading-7 text-on-surface-variant">
          Мы сохранили оболочку приложения. Как только соединение вернётся, можно продолжить работу с рынком, генерацией и результатами.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/overview" className="aug-button aug-button--primary">Повторить</Link>
          <Link href="/history" className="aug-button aug-button--secondary">История</Link>
        </div>
      </section>
    </main>
  )
}
