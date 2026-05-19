import Link from 'next/link';
import { Github, Twitter, Facebook, Instagram, Mail } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="container mx-auto px-8 py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div>
            <div className="mb-4 flex items-center gap-2 text-xl font-bold text-primary-600">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-xs font-bold text-white">
                HH
              </span>
              HealthHub
            </div>
            <p className="text-sm text-gray-600">
              Your household wellness hub — focus, nutrition, and evidence-based
              learning.
            </p>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold text-gray-900">Explore</h3>
            <ul className="flex flex-col gap-2">
              <li>
                <Link
                  href="/timer"
                  className="text-sm text-gray-600 hover:text-primary-600"
                >
                  Focus Timer
                </Link>
              </li>
              <li>
                <Link
                  href="/recipes"
                  className="text-sm text-gray-600 hover:text-primary-600"
                >
                  Recipes
                </Link>
              </li>
              <li>
                <Link
                  href="/learn"
                  className="text-sm text-gray-600 hover:text-primary-600"
                >
                  Learn
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold text-gray-900">Account</h3>
            <ul className="flex flex-col gap-2">
              <li>
                <Link
                  href="/sign-in"
                  className="text-sm text-gray-600 hover:text-primary-600"
                >
                  Sign In
                </Link>
              </li>
              <li>
                <Link
                  href="/sign-up"
                  className="text-sm text-gray-600 hover:text-primary-600"
                >
                  Create Account
                </Link>
              </li>
              <li>
                <Link
                  href="/pro"
                  className="text-sm text-gray-600 hover:text-primary-600"
                >
                  HealthHub Pro
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard"
                  className="text-sm text-gray-600 hover:text-primary-600"
                >
                  Dashboard
                </Link>
              </li>
            </ul>
            <p className="mt-3 text-xs text-gray-500">
              Meal planner, journal, and groceries require sign-in.
            </p>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-semibold text-gray-900">Connect</h3>
            <div className="mb-4 flex gap-4">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-gray-600"
                aria-label="GitHub"
              >
                <Github className="h-5 w-5" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-gray-600"
                aria-label="Twitter"
              >
                <Twitter className="h-5 w-5" />
              </a>
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-gray-600"
                aria-label="Facebook"
              >
                <Facebook className="h-5 w-5" />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-gray-600"
                aria-label="Instagram"
              >
                <Instagram className="h-5 w-5" />
              </a>
              <a
                href="mailto:support@healthhub.com"
                className="text-gray-400 hover:text-gray-600"
                aria-label="Email"
              >
                <Mail className="h-5 w-5" />
              </a>
            </div>
            <div className="flex flex-col gap-2 text-xs text-gray-500">
              <Link href="/privacy" className="hover:text-gray-700">
                Privacy Policy
              </Link>
              <Link href="/terms" className="hover:text-gray-700">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-gray-200 pt-8 text-center text-sm text-gray-500">
          <p>© {new Date().getFullYear()} HealthHub. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
