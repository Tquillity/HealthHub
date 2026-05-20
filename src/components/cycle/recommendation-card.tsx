'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import type { Prisma } from '@prisma/client';

/**
 * RecommendationCard Component
 * 
 * Displays a single expert recommendation for a specific cycle phase.
 * 
 * Purpose:
 * - Renders phase-specific recommendations from experts (e.g., Dr. Mindy Pelz, Dr. Stacy Sims)
 * - Handles flexible JSON content structure from PhaseRecommendation.content field
 * - Displays expert attribution, credentials, and source links
 * 
 * Content Types Supported:
 * - foods_to_eat: Array of recommended foods (displayed as bulleted list)
 * - foods_to_avoid: Array of foods to avoid (displayed with × indicator)
 * - workout_types: Array of recommended exercise types (displayed with ✓ indicator)
 * - guidance: General text guidance for the phase
 * - nutrition: Nutrition-specific tips
 * 
 * Design:
 * - Category badges (Nutrition/Fasting/Exercise) with color coding
 * - Expert name and credentials prominently displayed
 * - Source and website links in footer
 */

/**
 * Type for PhaseRecommendation with included Expert relation
 * Extracted from the actual Prisma query return type in cycle-actions.ts
 */
type PhaseRecommendationWithExpert = {
  id: string;
  expertId: string;
  phase: string;
  category: string;
  content: Prisma.JsonValue;
  source: string | null;
  createdAt: Date;
  updatedAt: Date;
  expert: {
    id: string;
    name: string;
    credentials: string | null;
    website: string | null;
    focusAreas: string[];
  };
};

interface RecommendationContent {
  foods_to_eat?: string[];
  foods_to_avoid?: string[];
  workout_types?: string[];
  guidance?: string;
  nutrition?: string;
}

interface RecommendationCardProps {
  recommendation: PhaseRecommendationWithExpert;
}

const CATEGORY_LABELS: Record<string, string> = {
  nutrition: 'Nutrition',
  fasting: 'Fasting',
  exercise: 'Exercise',
};

const CATEGORY_COLORS: Record<string, string> = {
  nutrition: 'bg-wellness-100 text-wellness-700 border-wellness-300',
  fasting: 'bg-primary-100 text-primary-700 border-primary-300',
  exercise: 'bg-blue-100 text-blue-700 border-blue-300',
};

export function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const content = recommendation.content as RecommendationContent;
  const categoryLabel = CATEGORY_LABELS[recommendation.category] || recommendation.category;
  const categoryColor = CATEGORY_COLORS[recommendation.category] || 'bg-gray-100 text-gray-700 border-gray-300';

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900">
              {recommendation.expert.name}
            </h3>
            {recommendation.expert.credentials && (
              <span className="text-xs text-gray-500">
                {recommendation.expert.credentials}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 italic">
            {recommendation.expert.name} says...
          </p>
        </div>
        <span className={`px-2 py-1 rounded text-xs font-medium border ${categoryColor}`}>
          {categoryLabel}
        </span>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-3">
        {content.foods_to_eat && content.foods_to_eat.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-1.5">Foods to Eat</h4>
            <ul className="flex flex-col gap-1">
              {content.foods_to_eat.map((food, index) => (
                <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className="text-wellness-600 mt-1">•</span>
                  <span>{food}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {content.foods_to_avoid && content.foods_to_avoid.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-1.5">Foods to Avoid</h4>
            <ul className="flex flex-col gap-1">
              {content.foods_to_avoid.map((food, index) => (
                <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className="text-red-500 mt-1">×</span>
                  <span>{food}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {content.workout_types && content.workout_types.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-1.5">Recommended Workouts</h4>
            <ul className="flex flex-col gap-1">
              {content.workout_types.map((workout, index) => (
                <li key={index} className="text-sm text-gray-700 flex items-start gap-2">
                  <span className="text-blue-600 mt-1">✓</span>
                  <span>{workout}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {content.guidance && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-1.5">Guidance</h4>
            <p className="text-sm text-gray-700 leading-relaxed">{content.guidance}</p>
          </div>
        )}

        {content.nutrition && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-1.5">Nutrition Tips</h4>
            <p className="text-sm text-gray-700 leading-relaxed">{content.nutrition}</p>
          </div>
        )}
      </div>

      <div className="pt-3 border-t border-gray-200">
        <Link
          href={`/learn?category=${encodeURIComponent(recommendation.category)}`}
          className="text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          Related in Learn →
        </Link>
      </div>

      {/* Footer */}
      {recommendation.source && (
        <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
          <ExternalLink className="h-3 w-3 text-gray-400" />
          <a
            href={recommendation.source}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Source
          </a>
        </div>
      )}

      {recommendation.expert.website && (
        <div className="flex items-center gap-2 pt-2">
          <ExternalLink className="h-3 w-3 text-gray-400" />
          <a
            href={recommendation.expert.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Visit {recommendation.expert.name}'s website
          </a>
        </div>
      )}
    </div>
  );
}

