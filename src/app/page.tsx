import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
          Welcome to HealthAssist
        </h1>
        <p className="mt-6 text-lg leading-8 text-gray-600">
          Your comprehensive health management companion
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <Link href="/sign-up">
            <Button size="lg" className="bg-primary-500 text-white hover:bg-primary-600">
              Get Started
            </Button>
          </Link>
          <Link href="/sign-in">
            <Button variant="outline" size="lg">
              Sign In
            </Button>
          </Link>
        </div>
        {/* Verification: Primary color should be #0ea5e9 */}
        <div className="mt-8 rounded-lg bg-primary-500 p-4 text-primary-50">
          <p className="text-sm font-medium">
            Color Verification: This box uses primary-500 (#0ea5e9)
          </p>
        </div>
      </div>
    </div>
  );
}
