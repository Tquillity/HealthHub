import type { z } from 'zod';
import type { LearnTldrSchema } from '@/lib/validation/education-schemas';

/**
 * Learn articles for circadian insights (issue #13): the male daily (diurnal) hormone
 * pattern and how to line up light, sleep, meals and training with it. Seeded by
 * src/db/seed.ts, matched on title, so re-seeding never duplicates them.
 *
 * Wellness education only: every claim is cited in the article's Sources list, worded as
 * a typical pattern rather than a measurement of the reader, and the articles never
 * suggest diagnosing or treating anything.
 */

export const CIRCADIAN_CATEGORY = 'circadian';

export type SeedEducationalResource = {
  title: string;
  content: string;
  excerpt: string;
  category: string;
  tags: string[];
  difficulty: string;
  readTime: number;
  featured: boolean;
  tldr: z.input<typeof LearnTldrSchema>;
};

const WELLNESS_NOTE = `
              <p><em>General wellness information, not medical advice. Everyone's rhythm is a little different. If you have ongoing tiredness, low mood, low sex drive or sleep problems, talk to a healthcare professional rather than trying to self-diagnose.</em></p>`;

export const CIRCADIAN_RESOURCES: SeedEducationalResource[] = [
  {
    title: 'Your Daily Testosterone Rhythm: Highest in the Morning',
    content: `
              <h2>A daily rhythm, not a monthly cycle</h2>
              <p>Male hormones do not follow a monthly cycle the way the menstrual cycle does. They follow the 24-hour circadian rhythm instead. Testosterone is typically at its highest in the early morning, eases off gradually through the day, and is built back up overnight while you sleep.</p>

              <h3>What the research shows</h3>
              <ul>
                <li><strong>Morning peak, afternoon dip:</strong> in a large community study of men, testosterone measured at 4 pm was on average roughly 10-15% lower than at 8 am in men in their 30s. The daily swing becomes smaller with age.</li>
                <li><strong>Sleep rebuilds it:</strong> testosterone rises during sleep, and broken-up sleep blunts that nightly rise.</li>
                <li><strong>Short sleep lowers it:</strong> in young healthy men, one week of 5-hour nights lowered daytime testosterone by 10-15%.</li>
                <li><strong>Why labs test in the morning:</strong> because of this rhythm, testosterone blood tests are usually taken in the morning.</li>
              </ul>

              <h3>What this means day to day</h3>
              <ul>
                <li><strong>Protect your sleep.</strong> It is when testosterone is restored. Most adults need 7 hours or more.</li>
                <li><strong>Use your morning drive.</strong> Many people feel most driven from mid to late morning, a good slot for demanding work or a strength session if it fits your day.</li>
                <li><strong>Look at patterns, not single days.</strong> Levels move with sleep, stress, illness, alcohol, body weight and age. One low-energy day does not say much on its own.</li>
              </ul>

              <h3>What it does not mean</h3>
              <p>You do not need to time every workout to the morning peak. Strength and power usually peak in the late afternoon, and training at a time you can stick to matters more than the clock. See <em>Aligning Training, Meals and Recovery With Your Day</em>.</p>

              <h3>Sources</h3>
              <ol>
                <li>Brambilla DJ, Matsumoto AM, Araujo AB, McKinlay JB. The effect of diurnal variation on clinical measurement of serum testosterone and other sex hormone levels in men. <em>J Clin Endocrinol Metab</em>. 2009;94(3):907-913.</li>
                <li>Luboshitzky R, Zabari Z, Shen-Orr Z, Herer P, Lavie P. Disruption of the nocturnal testosterone rhythm by sleep fragmentation in normal men. <em>J Clin Endocrinol Metab</em>. 2001;86(3):1134-1139.</li>
                <li>Leproult R, Van Cauter E. Effect of 1 week of sleep restriction on testosterone levels in young healthy men. <em>JAMA</em>. 2011;305(21):2173-2174.</li>
                <li>Bhasin S, Brito JP, Cunningham GR, et al. Testosterone therapy in men with hypogonadism: an Endocrine Society clinical practice guideline. <em>J Clin Endocrinol Metab</em>. 2018;103(5):1715-1744.</li>
                <li>Watson NF, Badr MS, Belenky G, et al. Recommended amount of sleep for a healthy adult: a joint consensus statement of the American Academy of Sleep Medicine and Sleep Research Society. <em>Sleep</em>. 2015;38(6):843-844.</li>
              </ol>${WELLNESS_NOTE}
            `,
    excerpt:
      'Testosterone follows a daily rhythm rather than a monthly cycle: highest in the early morning, lower by the afternoon, and rebuilt overnight while you sleep.',
    category: CIRCADIAN_CATEGORY,
    tags: [
      'circadian rhythm',
      'circadian insights',
      'testosterone',
      "men's health",
      'sleep',
    ],
    difficulty: 'beginner',
    readTime: 5,
    featured: false,
    tldr: {
      summary:
        'Testosterone peaks in the early morning, is roughly 10-15% lower by late afternoon in younger men, and is rebuilt during sleep.',
      whenToTake:
        'Mid to late morning is a natural high for drive and focus: a good slot for demanding work or training if it fits your day.',
      howToTake:
        'Support the rhythm with 7+ hours of sleep, a regular wake time and daylight soon after waking.',
      takeWith: [
        'Consistent sleep and wake times',
        'Morning daylight',
        'Training at a time you can keep up',
      ],
      avoidWith: [
        'Regular 5-hour nights',
        'Judging yourself on a single low day',
        'Self-testing or self-treating hormones',
      ],
      keyPoints: [
        'A daily rhythm, not a monthly cycle',
        'Sleep is when testosterone is restored',
        'The daily swing gets smaller with age',
      ],
      cautions: [
        'Not a diagnostic tool: ongoing tiredness, low mood or low sex drive are worth discussing with a healthcare professional',
      ],
      duration:
        'Repeats every day; a week of short sleep was enough to lower daytime levels.',
    },
  },
  {
    title: 'The Cortisol Awakening Response: Your Built-In Morning Boost',
    content: `
              <h2>A normal morning surge</h2>
              <p>Cortisol is often called the stress hormone, but its daily rhythm is a healthy part of waking up. In the first 30-45 minutes after you wake, cortisol rises by roughly 50%. This is the <strong>cortisol awakening response</strong>. It helps mobilise energy and sharpen attention for the day ahead.</p>

              <h3>The daily curve</h3>
              <ul>
                <li><strong>Morning:</strong> the awakening surge, then the highest levels of the day.</li>
                <li><strong>Afternoon:</strong> a steady decline.</li>
                <li><strong>Late evening:</strong> the lowest point is around midnight, which makes room for sleep.</li>
              </ul>
              <p>Testosterone is also highest in the morning, which is part of why many people feel at their sharpest in the first half of the day.</p>

              <h3>What shapes your morning response</h3>
              <ul>
                <li><strong>Waking time:</strong> the response is tied to the moment you wake, so a regular wake time keeps it predictable.</li>
                <li><strong>Morning light:</strong> bright light after waking raised morning cortisol in a controlled study.</li>
                <li><strong>The day ahead:</strong> the response tends to be larger on days people expect to be demanding.</li>
                <li><strong>Sleep:</strong> short or broken sleep disturbs the normal daily pattern.</li>
              </ul>

              <h3>Working with it</h3>
              <ul>
                <li>Keep your wake time within about an hour, weekends included.</li>
                <li>Get daylight soon after waking: a short walk outside or breakfast by a window.</li>
                <li>Put your most demanding tasks where you feel sharpest, often mid to late morning.</li>
                <li>Let evenings be calmer: cortisol should be falling by then, and stressful work late at night can make it harder to wind down.</li>
              </ul>

              <h3>Sources</h3>
              <ol>
                <li>Wüst S, Wolf J, Hellhammer DH, Federenko I, Schommer N, Kirschbaum C. The cortisol awakening response: normal values and confounds. <em>Noise Health</em>. 2000;2(7):79-88.</li>
                <li>Clow A, Hucklebridge F, Stalder T, Evans P, Thorn L. The cortisol awakening response: more than a measure of HPA axis function. <em>Neurosci Biobehav Rev</em>. 2010;35(1):97-103.</li>
                <li>Fries E, Dettenborn L, Kirschbaum C. The cortisol awakening response (CAR): facts and future directions. <em>Int J Psychophysiol</em>. 2009;72(1):67-73.</li>
                <li>Scheer FA, Buijs RM. Light affects morning salivary cortisol in humans. <em>J Clin Endocrinol Metab</em>. 1999;84(9):3395-3398.</li>
                <li>Debono M, Ghobadi C, Rostami-Hodjegan A, et al. Modified-release hydrocortisone to provide circadian cortisol profiles. <em>J Clin Endocrinol Metab</em>. 2009;94(5):1548-1554.</li>
              </ol>${WELLNESS_NOTE}
            `,
    excerpt:
      'Cortisol rises by about half in the first 30-45 minutes after waking. Here is what this normal morning surge does and how to work with it.',
    category: CIRCADIAN_CATEGORY,
    tags: [
      'circadian rhythm',
      'circadian insights',
      'cortisol',
      'morning routine',
      'stress',
    ],
    difficulty: 'beginner',
    readTime: 5,
    featured: false,
    tldr: {
      summary:
        'Cortisol rises by roughly 50% within 30-45 minutes of waking, peaks in the morning and falls to its lowest around midnight.',
      whenToTake:
        'Plan demanding tasks for mid to late morning; keep evenings calmer while cortisol falls.',
      howToTake: 'Keep a regular wake time and get daylight soon after waking.',
      takeWith: [
        'A consistent wake time (within about an hour)',
        'Morning daylight',
        'A calmer evening routine',
      ],
      avoidWith: ['Very irregular wake times', 'Stressful work late at night'],
      keyPoints: [
        'The morning cortisol rise is normal and helpful',
        'It is tied to the moment you wake up',
        'Light and the day ahead both shape it',
      ],
      cautions: [
        'Ongoing exhaustion or anxiety deserves a conversation with a healthcare professional',
      ],
      duration: 'Repeats every morning.',
    },
  },
  {
    title: 'Deep Sleep and Growth Hormone: Why the First Hours of Sleep Matter',
    content: `
              <h2>Growth hormone comes at night</h2>
              <p>In men, most of the day's growth hormone is released in one large pulse shortly after falling asleep, during deep (slow-wave) sleep. Growth hormone supports tissue repair, muscle and bone, and how the body uses fat, so the first hours of the night do a lot of quiet work.</p>

              <h3>What the research shows</h3>
              <ul>
                <li><strong>Tied to deep sleep:</strong> the biggest growth hormone pulse appears with the first period of slow-wave sleep.</li>
                <li><strong>Changes with age:</strong> deep sleep declines markedly from young adulthood to midlife, and growth hormone release falls along with it.</li>
                <li><strong>Alcohol gets in the way:</strong> drinking before bed suppressed the sleep-related growth hormone pulse.</li>
                <li><strong>Testosterone too:</strong> testosterone is restored during sleep, and a week of 5-hour nights lowered it by 10-15% in young men.</li>
              </ul>

              <h3>Protecting your deep sleep</h3>
              <ul>
                <li><strong>Give sleep enough time:</strong> most adults need 7 hours or more.</li>
                <li><strong>Keep a regular bedtime</strong> so deep sleep arrives on schedule.</li>
                <li><strong>Make the bedroom dark and cool:</strong> heat disturbs deep sleep.</li>
                <li><strong>Go easy on alcohol in the evening.</strong></li>
                <li><strong>Move during the day:</strong> regular exercise is linked to more deep sleep. Very hard sessions that end within about an hour of bedtime can make falling asleep harder.</li>
              </ul>

              <h3>Sources</h3>
              <ol>
                <li>Takahashi Y, Kipnis DM, Daughaday WH. Growth hormone secretion during sleep. <em>J Clin Invest</em>. 1968;47(9):2079-2090.</li>
                <li>Van Cauter E, Leproult R, Plat L. Age-related changes in slow wave sleep and REM sleep and relationship with growth hormone and cortisol levels in healthy men. <em>JAMA</em>. 2000;284(7):861-868.</li>
                <li>Prinz PN, Roehrs TA, Vitaliano PP, Linnoila M, Weitzman ED. Effect of alcohol on sleep and nighttime plasma growth hormone and cortisol concentrations. <em>J Clin Endocrinol Metab</em>. 1980;51(4):759-764.</li>
                <li>Leproult R, Van Cauter E. Effect of 1 week of sleep restriction on testosterone levels in young healthy men. <em>JAMA</em>. 2011;305(21):2173-2174.</li>
                <li>Okamoto-Mizuno K, Mizuno K. Effects of thermal environment on sleep and circadian rhythm. <em>J Physiol Anthropol</em>. 2012;31:14.</li>
                <li>Kubitz KA, Landers DM, Petruzzello SJ, Han M. The effects of acute and chronic exercise on sleep: a meta-analytic review. <em>Sports Med</em>. 1996;21(4):277-291.</li>
                <li>Stutz J, Eiholzer R, Spengler CM. Effects of evening exercise on sleep in healthy participants: a systematic review and meta-analysis. <em>Sports Med</em>. 2019;49(2):269-287.</li>
              </ol>${WELLNESS_NOTE}
            `,
    excerpt:
      'Most growth hormone is released in deep sleep early in the night, and testosterone is restored while you sleep. Simple ways to protect those hours.',
    category: CIRCADIAN_CATEGORY,
    tags: [
      'circadian rhythm',
      'circadian insights',
      'growth hormone',
      'deep sleep',
      'recovery',
    ],
    difficulty: 'intermediate',
    readTime: 5,
    featured: false,
    tldr: {
      summary:
        'The largest growth hormone pulse comes with deep sleep shortly after you fall asleep; protect the first hours of the night.',
      whenToTake:
        'A regular bedtime with 7+ hours in bed; finish hard exercise at least an hour before bed.',
      howToTake:
        'Dark, cool bedroom; little or no alcohol in the evening; daytime movement.',
      takeWith: [
        'A regular bedtime',
        'A cool, dark bedroom',
        'Exercise earlier in the day',
      ],
      avoidWith: [
        'Alcohol close to bedtime',
        'Very hard workouts ending within an hour of bed',
        'A warm, bright bedroom',
      ],
      keyPoints: [
        'Most growth hormone is released in early deep sleep',
        'Deep sleep falls with age, and growth hormone with it',
        'Testosterone is also restored during sleep',
      ],
      cautions: [
        'Persistent poor sleep, loud snoring or daytime sleepiness should be checked by a healthcare professional',
      ],
      duration: 'Nightly; consistency over weeks matters most.',
    },
  },
  {
    title: 'Timing Light, Sleep and Meals Around Your Body Clock',
    content: `
              <h2>Your body clock runs on cues</h2>
              <p>Your internal clock is reset every day by a few strong cues: light above all, then sleep timing and meal timing. Giving it clear, regular signals helps your hormones, energy and sleep line up with your day.</p>

              <h3>Light</h3>
              <ul>
                <li><strong>Morning light</strong> moves your clock earlier and supports alertness, making it easier to fall asleep at night.</li>
                <li><strong>Evening light</strong> does the opposite: ordinary room light before bed suppressed melatonin, and reading on a light-emitting screen before bed delayed melatonin and left people less alert the next morning.</li>
              </ul>

              <h3>Sleep</h3>
              <ul>
                <li>Keep bed and wake times regular. Irregular sleep schedules are linked with a later body clock and poorer daytime performance.</li>
                <li>Aim for 7 hours or more.</li>
                <li>Caffeine taken even 6 hours before bed reduced sleep, so keep coffee to the earlier part of the day.</li>
              </ul>

              <h3>Meals</h3>
              <ul>
                <li>Meal timing is a clock cue too: shifting meals later shifted the body's daily glucose rhythm.</li>
                <li>The body handles carbohydrates less efficiently in the evening, so bigger, earlier meals and a lighter dinner suit the rhythm.</li>
                <li>Large meals close to bedtime were linked with poorer sleep. Finishing dinner a few hours before bed is a simple habit.</li>
              </ul>

              <h3>A simple day plan</h3>
              <ul>
                <li><strong>Morning:</strong> daylight soon after waking and a protein-rich breakfast.</li>
                <li><strong>Afternoon:</strong> last coffee by early afternoon; a short walk for the post-lunch dip.</li>
                <li><strong>Evening:</strong> a lighter dinner, dimmer and warmer lights, screens down.</li>
                <li><strong>Night:</strong> a dark, cool, quiet bedroom.</li>
              </ul>

              <h3>Sources</h3>
              <ol>
                <li>Khalsa SBS, Jewett ME, Cajochen C, Czeisler CA. A phase response curve to single bright light pulses in human subjects. <em>J Physiol</em>. 2003;549(Pt 3):945-952.</li>
                <li>Gooley JJ, Chamberlain K, Smith KA, et al. Exposure to room light before bedtime suppresses melatonin onset and shortens melatonin duration in humans. <em>J Clin Endocrinol Metab</em>. 2011;96(3):E463-E472.</li>
                <li>Chang AM, Aeschbach D, Duffy JF, Czeisler CA. Evening use of light-emitting eReaders negatively affects sleep, circadian timing, and next-morning alertness. <em>Proc Natl Acad Sci U S A</em>. 2015;112(4):1232-1237.</li>
                <li>Phillips AJK, Clerx WM, O'Brien CS, et al. Irregular sleep/wake patterns are associated with poorer academic performance and delayed circadian and sleep/wake timing. <em>Sci Rep</em>. 2017;7:3216.</li>
                <li>Drake C, Roehrs T, Shambroom J, Roth T. Caffeine effects on sleep taken 0, 3, or 6 hours before going to bed. <em>J Clin Sleep Med</em>. 2013;9(11):1195-1200.</li>
                <li>Wehrens SMT, Christou S, Isherwood C, et al. Meal timing regulates the human circadian system. <em>Curr Biol</em>. 2017;27(12):1768-1775.</li>
                <li>Van Cauter E, Polonsky KS, Scheen AJ. Roles of circadian rhythmicity and sleep in human glucose regulation. <em>Endocr Rev</em>. 1997;18(5):716-738.</li>
                <li>Crispim CA, Zimberg IZ, dos Reis BG, Diniz RM, Tufik S, de Mello MT. Relationship between food intake and sleep pattern in healthy individuals. <em>J Clin Sleep Med</em>. 2011;7(6):659-664.</li>
              </ol>${WELLNESS_NOTE}
            `,
    excerpt:
      'Light, sleep timing and meal timing are the cues that set your body clock. A simple plan for morning, afternoon, evening and night.',
    category: CIRCADIAN_CATEGORY,
    tags: [
      'circadian rhythm',
      'circadian insights',
      'light',
      'sleep schedule',
      'meal timing',
    ],
    difficulty: 'beginner',
    readTime: 6,
    featured: false,
    tldr: {
      summary:
        'Bright mornings, dim evenings, regular sleep, earlier caffeine and a lighter dinner keep your body clock on time.',
      whenToTake:
        'Daylight soon after waking; last coffee by early afternoon; dinner a few hours before bed; lights down in the last hours of the evening.',
      howToTake:
        'Treat light, sleep and meals as daily cues and keep them at roughly the same times.',
      takeWith: [
        'Morning daylight',
        'A protein-rich breakfast',
        'Dim, warm evening light',
      ],
      avoidWith: [
        'Bright screens in bed',
        'Caffeine within about 6 hours of bedtime',
        'Large meals right before bed',
      ],
      keyPoints: [
        'Light is the strongest clock cue',
        'Meal timing is a clock cue too',
        'Regular timing matters more than perfect timing',
      ],
      cautions: [
        'Shift work and jet lag need their own plan; ask a healthcare professional if sleep problems persist',
      ],
      duration: 'Give a new routine 1-2 weeks before judging it.',
    },
  },
  {
    title: 'Aligning Training, Meals and Recovery With Your Day',
    content: `
              <h2>Use your daily rhythm, do not be ruled by it</h2>
              <p>Hormones, body temperature and alertness all follow a daily rhythm, and they do not all peak at once. Knowing the typical pattern helps you place training, meals and recovery, but the best plan is still the one you can keep.</p>

              <h3>Training</h3>
              <ul>
                <li><strong>Late afternoon is the typical performance peak.</strong> Strength, power and body temperature tend to be highest then.</li>
                <li><strong>Mornings work too.</strong> Testosterone and cortisol are highest in the morning, but muscles are cooler and stiffer soon after waking. A longer warm-up narrows the gap.</li>
                <li><strong>Consistency beats the clock.</strong> Men who trained in the morning or in the late afternoon for 10 weeks gained similar muscle size, and performance tends to adapt to the time of day you usually train.</li>
                <li><strong>Early-afternoon dip:</strong> alertness naturally dips after lunch. A 10-minute walk is a good use of it, and breaking up long sitting with short walks raised people's sense of energy.</li>
              </ul>

              <h3>Meals</h3>
              <ul>
                <li><strong>Spread your protein:</strong> about 20-30 g per meal (roughly 0.4 g per kg of body weight) supports muscle repair better than one large protein meal. A protein-rich breakfast is an easy place to start.</li>
                <li><strong>Lighter evenings:</strong> carbohydrates are handled less efficiently in the evening, so a lighter dinner with vegetables and some protein fits the rhythm.</li>
                <li><strong>After evening training:</strong> a small protein-rich snack before bed supported overnight muscle repair in young men who trained regularly.</li>
              </ul>

              <h3>Recovery</h3>
              <ul>
                <li>Evenings suit stretching, mobility and easy walks.</li>
                <li>Evening exercise is fine for most people's sleep, but very hard sessions that end within about an hour of bedtime can delay sleep.</li>
                <li>Sleep is where growth hormone and testosterone are restored: aim for 7 hours or more.</li>
              </ul>

              <h3>Your own rhythm</h3>
              <p>Some people are natural early birds and others night owls. That is why HealthHub's <strong>Circadian insights</strong> (turn them on in your profile) let you rate your energy in the morning, afternoon and evening. After a few weeks your own best window shows up, and the routine lottery leans towards routines that suit the time of day.</p>

              <h3>Sources</h3>
              <ol>
                <li>Chtourou H, Souissi N. The effect of training at a specific time of day: a review. <em>J Strength Cond Res</em>. 2012;26(7):1984-2005.</li>
                <li>Drust B, Waterhouse J, Atkinson G, Edwards B, Reilly T. Circadian rhythms in sports performance: an update. <em>Chronobiol Int</em>. 2005;22(1):21-44.</li>
                <li>Sedliak M, Finni T, Cheng S, Lind M, Häkkinen K. Effect of time-of-day-specific strength training on muscular hypertrophy in men. <em>J Strength Cond Res</em>. 2009;23(9):2451-2457.</li>
                <li>Monk TH. The post-lunch dip in performance. <em>Clin Sports Med</em>. 2005;24(2):e15-e23.</li>
                <li>Bergouignan A, Legget KT, De Jong N, et al. Effect of frequent interruptions of prolonged sitting on self-perceived levels of energy, mood, food cravings and cognitive function. <em>Int J Behav Nutr Phys Act</em>. 2016;13:113.</li>
                <li>Schoenfeld BJ, Aragon AA. How much protein can the body use in a single meal for muscle-building? Implications for daily protein distribution. <em>J Int Soc Sports Nutr</em>. 2018;15:10.</li>
                <li>Mamerow MM, Mettler JA, English KL, et al. Dietary protein distribution positively influences 24-h muscle protein synthesis in healthy adults. <em>J Nutr</em>. 2014;144(6):876-880.</li>
                <li>Snijders T, Res PT, Smeets JS, et al. Protein ingestion before sleep increases muscle mass and strength gains during prolonged resistance-type exercise training in healthy young men. <em>J Nutr</em>. 2015;145(6):1178-1184.</li>
                <li>Van Cauter E, Polonsky KS, Scheen AJ. Roles of circadian rhythmicity and sleep in human glucose regulation. <em>Endocr Rev</em>. 1997;18(5):716-738.</li>
                <li>Stutz J, Eiholzer R, Spengler CM. Effects of evening exercise on sleep in healthy participants: a systematic review and meta-analysis. <em>Sports Med</em>. 2019;49(2):269-287.</li>
                <li>Roenneberg T, Kuehnle T, Juda M, et al. Epidemiology of the human circadian clock. <em>Sleep Med Rev</em>. 2007;11(6):429-438.</li>
              </ol>${WELLNESS_NOTE}
            `,
    excerpt:
      'Performance tends to peak in the late afternoon, hormones in the morning, and consistency matters most. How to place training, meals and recovery in your day.',
    category: CIRCADIAN_CATEGORY,
    tags: [
      'circadian rhythm',
      'circadian insights',
      'training',
      'protein',
      'recovery',
    ],
    difficulty: 'intermediate',
    readTime: 7,
    featured: false,
    tldr: {
      summary:
        'Strength peaks in the late afternoon, hormones in the morning; train when you can be consistent, spread protein across meals and keep evenings for recovery.',
      whenToTake:
        'Harder sessions late morning or late afternoon; a short walk for the early-afternoon dip; stretching and mobility in the evening.',
      howToTake:
        'Warm up longer for early workouts and finish very hard sessions at least an hour before bed.',
      portioning:
        'About 20-30 g of protein per meal (roughly 0.4 g per kg of body weight).',
      takeWith: [
        'A protein-rich breakfast',
        'A regular training time',
        'An evening mobility routine',
      ],
      avoidWith: [
        'Very hard sessions ending within an hour of bed',
        'Skipping warm-ups on early mornings',
      ],
      keyPoints: [
        'Late afternoon is the typical performance peak',
        'Consistency beats perfect timing',
        'Your own energy check-ins beat the average pattern',
      ],
      cautions: [
        'Check with a healthcare professional before starting hard training if you have a heart condition or other health concerns',
      ],
      duration:
        'Muscle gains from morning or afternoon training were similar after 10 weeks.',
    },
  },
];
