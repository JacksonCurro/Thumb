import Link from "next/link";

export default function TestPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-3xl font-semibold">Hello from Trello Agent</h1>
      <Link href="/" className="text-sm text-primary underline underline-offset-4">
        Back to home
      </Link>
    </main>
  );
}
