import React from 'react';
import BlurText from './reactbits/BlurText';
import ShinyText from './reactbits/ShinyText';

/**
 * Title block at the top of each analysis page.
 */
function PageHeader({ eyebrow, title, description, icon: Icon }) {
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
      <BlurText
        as="h1"
        text={title}
        animateBy="words"
        direction="top"
        delay={90}
        className="text-3xl font-black tracking-tight sm:text-4xl md:text-5xl"
      />
      {description && (
        <p className="mt-3 max-w-2xl text-sm text-gray-400 sm:text-base animate-fade-up [animation-delay:250ms]">
          {description}
        </p>
      )}
      {/* Speed stripes */}
      <div className="mt-5 flex items-center gap-1.5" aria-hidden="true">
        <span className="h-1 w-16 -skew-x-[30deg] rounded-sm bg-f1-red" />
        <span className="h-1 w-6 -skew-x-[30deg] rounded-sm bg-f1-red/60" />
        <span className="h-1 w-3 -skew-x-[30deg] rounded-sm bg-f1-red/30" />
      </div>
    </header>
  );
}

export default PageHeader;
