export default function Loading() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col bg-[#f7f5ef]">
      <section className="px-5 pb-4 pt-6">
        <p className="text-sm font-medium text-[#7b341e]">扫码下单</p>
        <div className="mt-2 h-8 w-48 animate-pulse rounded-md bg-[#e8e3d8]" />
        <div className="mt-3 h-4 w-72 animate-pulse rounded bg-[#e8e3d8]" />
      </section>
      <section className="flex-1 space-y-3 px-4 pb-32">
        {[1, 2, 3].map((i) => (
          <div
            className="h-32 animate-pulse rounded-lg border border-[#e1ddd4] bg-[#efeae0]"
            key={i}
          />
        ))}
      </section>
    </main>
  );
}
