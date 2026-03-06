import Link from "next/link";

export default function TestPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-center text-3xl font-semibold">Hello from Trello Agent</h1>
      <Link href="/" className="text-sm text-primary underline-offset-4 hover:underline">
        Back to home
      </Link>
    </main>
  );
}
