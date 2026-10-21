/*
paintloop.js -- a timer FLOOR with a frame-rate improvement on top, for anything derived from time.

  loop(paint)  -> { stop }

One concern. Two consumers derive what they draw from the clock rather than from an event -- movers
along a route, and a beat revealing entities -- and both need the same shape for the same reason.

WHY BOTH HALVES. Chrome pauses `requestAnimationFrame` completely in a hidden tab. Driving either
consumer from rAF alone means a background peer stops painting entirely and then materialises the
backlog in one jump when the tab is focused -- a freeze followed by a leap, which is exactly what a
broken peer looks like from the outside. Driving from a timer alone gives a visible tab five frames
a second when the compositor could give it sixty.

So the timer is the FLOOR and rAF is the improvement: a visible tab paints every frame, a hidden one
still paints at the interval. Timers are throttled in background tabs too, but throttled is not
stopped.

Extracted after `scan-twins` reported it at 57%: the rule and the reasoning had been copied into a
second file, which is two owners for one decision and how the two would come to disagree about the
floor. The interval stays the caller's, because a mover and a beat move at different human speeds.
*/

/*
A clock source, defaulted once.

Both consumers take `now` injected so a test can drive them without waiting, and both fell back to
`Date.now` when it was absent -- the same two lines in two files, which is how one of them would
later be given a different default and nobody would notice. The fallback is honest rather than
hidden: a consumer handed no clock reads the machine's, which is wrong for parity and right for a
harness, and saying so once keeps the two answers identical.
*/
export function clockOf(now) {
	return typeof now === 'function' ? now : () => Date.now();
}

export function loop(paint, intervalMs) {
	const timer = setInterval(paint, intervalMs);
	let raf = null;
	const frame = () => {
		paint();
		raf = requestAnimationFrame(frame);
	};
	raf = requestAnimationFrame(frame);
	return {
		stop() {
			clearInterval(timer);
			if (raf) cancelAnimationFrame(raf);
			raf = null;
		},
	};
}
