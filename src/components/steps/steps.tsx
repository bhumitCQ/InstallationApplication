import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type StepItem = {
	key: string;
	title: string;
	description?: string;
};

type StepperProps = {
	steps: StepItem[];
	activeIndex: number;
	className?: string;
};

export const Stepper: React.FC<StepperProps> = ({ steps, activeIndex, className }) => {
	return (
		<ol className={["w-full max-w-3xl mx-auto", className ?? ""].join(" ")}>
			{steps.map((s, idx) => {
				const isDone = idx < activeIndex;
				const isActive = idx === activeIndex;
				return (
					<li key={s.key} className="relative flex gap-4 py-4">
						<div className="flex flex-col items-center">
							<div
								className={[
									'h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold ring-2',
									isDone ? 'bg-green-600 text-white ring-green-700' :
									isActive ? 'bg-blue-600 text-white ring-blue-700' :
									'bg-gray-200 text-gray-700 ring-gray-300'
								].join(' ')}
							>
								{isDone ? '✓' : idx + 1}
							</div>
							{idx < steps.length - 1 && (
								<div
									className={[
										'mt-2 w-px flex-1',
										isDone ? 'bg-green-500' : 'bg-gray-300'
									].join(' ')}
								/>
							)}
						</div>
						<div className="min-w-0">
							<div className="text-sm font-medium text-gray-900 text-left">{s.title}</div>
							{s.description ? (
								<div className="text-xs text-gray-600">{s.description}</div>
							) : null}
							{isActive && (
								<div className="mt-2 h-2 w-full bg-gray-200 rounded overflow-hidden">
									<div
										className="h-full bg-blue-600"
										style={{ width: `${Math.round(((idx + 1) / steps.length) * 100)}%` }}
									/>
								</div>
							)}
						</div>
					</li>
				);
			})}
		</ol>
	);
};

type AnimatedStepperLayoutProps = {
	title?: string;
	steps: StepItem[];
	activeIndex: number; // 0-based
	sidebarWidth?: string; // e.g. '280px'
	introOnce?: boolean; // show intro first time only
	startInIntro?: boolean; // force intro even if already shown
	introDurationMs?: number;
	className?: string;
	renderMain?: (activeStep: StepItem, activeIndex: number) => React.ReactNode;
	children?: React.ReactNode;
};

function clamp(n: number, min: number, max: number) {
	return Math.max(min, Math.min(max, n));
}

export const AnimatedStepperLayout: React.FC<AnimatedStepperLayoutProps> = ({
	title = 'Progress',
	steps,
	activeIndex,
	sidebarWidth = '280px',
	introOnce = true,
	startInIntro = true,
	introDurationMs = 1100,
	className,
	renderMain,
	children
}) => {
	const safeIndex = clamp(activeIndex ?? 0, 0, Math.max(steps.length - 1, 0));

	// phase: 'intro' (full-screen stepper), then 'app' (sidebar + main)
	const [phase, setPhase] = React.useState<'idle' | 'intro' | 'app'>(startInIntro ? 'idle' : 'app');
	const hasShownIntroRef = React.useRef(false);

	React.useEffect(() => {
		if (phase === 'app') return;
		// On first valid index, run intro -> app
		if (typeof safeIndex === 'number' && steps.length > 0) {
			// If introOnce and we already showed it in this session, skip to app
			if (introOnce && hasShownIntroRef.current && startInIntro) {
				setPhase('app');
				return;
			}
			if (phase === 'idle') setPhase('intro');
			const t = setTimeout(() => {
				hasShownIntroRef.current = true;
				setPhase('app');
			}, introDurationMs);
			return () => clearTimeout(t);
		}
	}, [phase, safeIndex, steps.length, introOnce, startInIntro, introDurationMs]);

	const mainContent = renderMain ? renderMain(steps[safeIndex], safeIndex) : children;

	return (
		<div className={["relative h-full w-full overflow-hidden bg-white", className ?? ""].join(" ")}>
			<AnimatePresence initial={false}>
				{phase !== 'app' && (
					<motion.div
						key="intro"
						className="absolute inset-0 flex items-center justify-center p-6"
						initial={{ opacity: 0, scale: 0.98 }}
						animate={{ opacity: 1, scale: 1 }}
						exit={{ opacity: 0, x: '-20%', transition: { duration: 0.35 } }}
						transition={{ duration: 0.45, ease: 'easeOut' }}
					>
						<div className="w-full max-w-4xl">
							<div style={{ maxWidth: "fit-content" }} className="mb-6 text-center flex flex-col m-auto">
								<h1 className="text-xl font-semibold text-gray-900">{title}</h1>
								<p className="text-sm text-gray-600">Follow along while we prepare things</p>
								<div className='flex flex-row m-au'>
									<Stepper steps={steps} activeIndex={safeIndex} />
								</div>
							</div>
						</div>
					</motion.div>
				)}

				{phase === 'app' && (
					<motion.div
						key="app"
						className="absolute inset-0 grid"
						style={{ gridTemplateColumns: `${sidebarWidth} 1fr` }}
						initial={{ x: '100%', opacity: 0 }}
						animate={{ x: 0, opacity: 1 }}
						transition={{ duration: 0.55, ease: 'easeOut' }}
					>
						<motion.aside
							className="h-full border-r bg-white/80 backdrop-blur-sm"
							initial={{ x: '-20%', opacity: 0 }}
							animate={{ x: 0, opacity: 1 }}
							transition={{ duration: 0.45, ease: 'easeOut', delay: 0.05 }}
						>
							<div className="p-4">
								<h2 className="text-sm font-semibold text-gray-800">{title}</h2>
							</div>
							<div className="px-3 pb-4 overflow-y-auto h-[calc(100%-48px)]">
								<Stepper steps={steps} activeIndex={safeIndex} />
							</div>
						</motion.aside>

						<motion.main
							className="h-full p-6 overflow-y-auto"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 }}
						>
							<header className="mb-4">
								<h1 className="text-xl font-semibold text-gray-900">
									{steps[safeIndex]?.title ?? ''}
								</h1>
								{steps[safeIndex]?.description ? (
									<p className="mt-1 text-sm text-gray-600">{steps[safeIndex].description}</p>
								) : null}
							</header>
							<section className="space-y-4">
								{mainContent}
							</section>
						</motion.main>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
};
