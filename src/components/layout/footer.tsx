import Link from 'next/link';
import { Github, Twitter, Facebook, Instagram, Mail } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="container mx-auto px-8 py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div>
            <div className="mb-4 flex items-center gap-2 text-xl font-bold text-blue-600">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-xs text-white">
                HH
              </div>
              HealthHub
            </div>
            <p className="text-sm text-gray-600">
              Your comprehensive wellness and meal planning companion.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-gray-900">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/dashboard" className="text-sm text-gray-600 hover:text-blue-600">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/recipes" className="text-sm text-gray-600 hover:text-blue-600">
                  Recipes
                </Link>
              </li>
              <li>
                <Link href="/meal-planner" className="text-sm text-gray-600 hover:text-blue-600">
                  Meal Planner
                </Link>
              </li>
              <li>
                <Link href="/routines" className="text-sm text-gray-600 hover:text-blue-600">
                  Routines
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-gray-900">Resources</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/learn" className="text-sm text-gray-600 hover:text-blue-600">
                  Educational Content
                </Link>
              </li>
              <li>
                <Link href="/journal" className="text-sm text-gray-600 hover:text-blue-600">
                  Wellness Journal
                </Link>
              </li>
              <li>
                <Link href="/groceries" className="text-sm text-gray-600 hover:text-blue-600">
                  Grocery List
                </Link>
              </li>
              <li>
                <Link href="/profile" className="text-sm text-gray-600 hover:text-blue-600">
                  Profile Settings
                </Link>
              </li>
            </ul>
          </div>

          {/* Social & Legal */}
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
            <div className="space-y-2 text-xs text-gray-500">
              <Link href="/privacy" className="hover:text-gray-700">
                Privacy Policy
              </Link>
              <span className="mx-2">•</span>
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

