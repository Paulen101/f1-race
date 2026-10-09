import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import BlurText from './reactbits/BlurText';
import DecryptedText from './reactbits/DecryptedText';
import GradientText from './reactbits/GradientText';
import ShinyText from './reactbits/ShinyText';

const TITLE_CLASS = 'text-3xl font-black tracking-tight sm:text-4xl md:text-5xl';

/** Letters spring up out of a mask, one after another. */
function RiseTitle({ text }) {
  let index = 0;
  return (
    <h1 className={TITLE_CLASS}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="flex flex-wrap gap-x-[0.25em]">
        {text.split(' ').map((word, w) => (
          <span key={w} className="-mb-[0.18em] inline-flex overflow-hidden pb-[0.18em]">
            {word.split('').map((char) => {
              const delay = index++ * 0.03;
              return (
                <motion.span
                  key={delay}
                  className="inline-block"
                  initial={{ y: '110%', rotate: 8, opacity: 0 }}
                  animate={{ y: 0, rotate: 0, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 26, delay }}
                >
                  {char}
                </motion.span>
              );
            })}
          </span>
        ))}
      </span>
    </h1>
  );
}

/**
 * Each page gets its own title entrance:
 *  - blur:     words resolve out of a blur (BlurText)
 *  - letters:  the same, letter by letter from below
 *  - decrypt:  characters scramble then lock in, like a timing screen (DecryptedText)
 *  - rise:     letters spring up out of a mask
 *  - gradient: a flowing red gradient that fades in (GradientText)
 */
function Title({ text, effect }) {
  switch (effect) {
    case 'decrypt':
      return (
        <h1 className={TITLE_CLASS}>
          <DecryptedText
            text={text}
            animateOn="view"
            sequential
            revealDirection="start"
            speed={35}
            characters="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
            encryptedClassName="text-f1-red-bright"
          />
        </h1>
      );
    case 'rise':
      return <RiseTitle text={text} />;
    case 'gradient':
      return (
        <motion.h1
          className={TITLE_CLASS}
          initial={{ opacity: 0, filter: 'blur(10px)', y: 12 }}
          animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          <GradientText colors={['#FF2A1F', '#FF8A3D', '#ffffff', '#FF2A1F']} animationSpeed={6} className="!justify-start">
            {text}
          </GradientText>
        </motion.h1>
      );
    case 'letters':
      return <BlurText as="h1" text={text} animateBy="letters" direction="bottom" delay={35} className={TITLE_CLASS} />;
    default:
      return <BlurText as="h1" text={text} animateBy="words" direction="top" delay={90} className={TITLE_CLASS} />;
  }
}

/**
 * Title block at the top of each analysis page.
 */
function PageHeader({ eyebrow, title, description, icon: Icon, effect = 'blur' }) {
  const reduceMotion = useReducedMotion();

  return (
    <header className="relative mb-8 sm:mb-10">
      {eyebrow && (
        <div className="mb-3 flex items-center gap-3">
          {Icon && (
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-f1-red/40 bg-f1-red/10 text-f1-red-bright">
              <Icon aria-hidden="true" />
            </span>
          )}
          <ShinyText
            text={eyebrow}
            className="text-xs font-semibold uppercase tracking-[0.25em]"
            color="#9ca3af"
            shineColor="#ffffff"
            speed={3}
          />
        </div>
      )}
      {reduceMotion ? <h1 className={TITLE_CLASS}>{title}</h1> : <Title text={title} effect={effect} />}
      {description && (
        <p className="mt-3 max-w-2xl text-sm text-gray-400 sm:text-base animate-fade-up [animation-delay:250ms]">
          {description}
        </p>
      )}
      {/* Speed stripes */}
      <div className="mt-5 flex items-center gap-1.5" aria-hidden="true">
        <motion.span
          className="h-1 w-16 origin-left -skew-x-[30deg] rounded-sm bg-f1-red"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.5, delay: 0.3, ease: 'easeOut' }}
        />
        <span className="h-1 w-6 -skew-x-[30deg] rounded-sm bg-f1-red/60" />
        <span className="h-1 w-3 -skew-x-[30deg] rounded-sm bg-f1-red/30" />
      </div>
    </header>
  );
}

export default PageHeader;
