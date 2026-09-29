(() => {
	const canvas = document.querySelector(".blueprint");
	const context = canvas?.getContext("2d", { alpha: true, desynchronized: true });
	if (!canvas || !context) return;

	const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
	const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	const frameInterval = coarsePointer ? 1000 / 24 : 1000 / 30;
	let width = 0;
	let height = 0;
	let gridSize = 36;
	let columns = 0;
	let rows = 0;
	let pointer = null;
	let dots = [];
	let renderedDots = [];
	let ripples = [];
	let lastRippleAt = -Infinity;
	let lastRipplePoint = null;
	let lastFrameTime = 0;
	let resizeFrame = null;

	function emitRipple(x, y, time) {
		const wavelength = 30 + Math.random() * 24;
		ripples.push({
			x,
			y,
			startedAt: time,
			speed: 0.11 + Math.random() * 0.08,
			width: 18 + Math.random() * 12,
			frequency: (Math.PI * 2) / wavelength,
			phase: Math.random() * Math.PI * 2,
			amplitude: 0.22 + Math.random() * 0.13
		});
		if (ripples.length > 12) ripples.shift();
		lastRippleAt = time;
		lastRipplePoint = { x, y };
	}

	function draw(time = 0) {
		context.clearRect(0, 0, width, height);

		for (let index = ripples.length - 1; index >= 0; index--) {
			if (time - ripples[index].startedAt >= 2200) ripples.splice(index, 1);
		}

		for (let index = 0; index < dots.length; index++) {
			const dot = dots[index];
			let waveEffect = 0;
			let offsetX = 0;
			let offsetY = 0;
			for (const ripple of ripples) {
				const age = Math.max(0, time - ripple.startedAt);
				const deltaX = dot.x - ripple.x;
				const deltaY = dot.y - ripple.y;
				const distance = Math.hypot(deltaX, deltaY);
				const distanceFromFront = distance - age * ripple.speed;
				const envelope = Math.exp(-(distanceFromFront ** 2) / (2 * ripple.width ** 2) - age / 1000);
				const wave = Math.sin(distanceFromFront * ripple.frequency + ripple.phase) * envelope * ripple.amplitude;
				const outwardPush = wave + envelope * ripple.amplitude * 0.7;
				waveEffect += wave;
				if (distance > 0) {
					offsetX += (deltaX / distance) * outwardPush * 18;
					offsetY += (deltaY / distance) * outwardPush * 18;
				}
			}

			const offsetLength = Math.hypot(offsetX, offsetY);
			const offsetScale = offsetLength > 14 ? 14 / offsetLength : 1;
			const breathing = Math.sin(time * dot.speed + dot.phase) * dot.amplitude;
			const wave = Math.tanh(waveEffect);
			const rippleInfluence = Math.abs(wave);
			const hoverDistance = pointer ? Math.hypot(dot.x - pointer.x, dot.y - pointer.y) : Infinity;
			const hoverInfluence = pointer ? Math.exp(-(hoverDistance ** 2) / (2 * 46 ** 2)) : 0;
			const driftX = Math.sin(time * dot.driftXSpeed + dot.driftXPhase) * dot.driftAmplitude;
			const driftY = Math.sin(time * dot.driftYSpeed + dot.driftYPhase) * dot.driftAmplitude;
			const renderedDot = renderedDots[index] || (renderedDots[index] = {});
			renderedDot.x = dot.x + driftX + offsetX * offsetScale;
			renderedDot.y = dot.y + driftY + offsetY * offsetScale;
			renderedDot.column = dot.column;
			renderedDot.row = dot.row;
			renderedDot.radius = Math.min(5.5, Math.max(0.65, 1.2 + breathing + rippleInfluence * 1.3 + hoverInfluence * 0.65));
			renderedDot.opacity = Math.min(0.8, 0.34 + breathing * 0.08 + rippleInfluence * 0.13 + hoverInfluence * 0.16);
		}
		renderedDots.length = dots.length;

		context.beginPath();
		context.lineWidth = 1;
		context.strokeStyle = "rgba(157, 199, 238, 0.13)";
		for (const dot of renderedDots) {
			const index = dot.column * rows + dot.row;
			if (dot.row + 1 < rows) {
				context.moveTo(dot.x, dot.y);
				context.lineTo(renderedDots[index + 1].x, renderedDots[index + 1].y);
			}
			if (dot.column + 1 < columns) {
				context.moveTo(dot.x, dot.y);
				context.lineTo(renderedDots[index + rows].x, renderedDots[index + rows].y);
			}
		}
		context.stroke();

		for (const dot of renderedDots) {
			context.beginPath();
			context.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
			context.fillStyle = `rgba(180, 216, 249, ${dot.opacity})`;
			context.fill();
		}
	}

	function animate(time) {
		if (time - lastFrameTime >= frameInterval) {
			draw(time);
			lastFrameTime = time;
		}
		requestAnimationFrame(animate);
	}

	function clearPointer() {
		pointer = null;
		lastRipplePoint = null;
		if (reduceMotion) draw();
	}

	function resize() {
		const pixelRatio = Math.min(window.devicePixelRatio || 1, coarsePointer ? 1.25 : 1.5);
		width = window.innerWidth;
		height = window.innerHeight;
		const targetDotCount = coarsePointer ? 600 : 900;
		gridSize = Math.max(coarsePointer ? 40 : 36, Math.min(84, Math.ceil(Math.sqrt(width * height / targetDotCount) / 4) * 4));
		columns = Math.floor(width / gridSize) + 1;
		rows = Math.floor(height / gridSize) + 1;
		canvas.width = Math.round(width * pixelRatio);
		canvas.height = Math.round(height * pixelRatio);
		context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
		dots = [];
		for (let column = 0; column < columns; column++) {
			for (let row = 0; row < rows; row++) {
				dots.push({
					x: column * gridSize,
					y: row * gridSize,
					column,
					row,
					phase: Math.random() * Math.PI * 2,
					speed: 0.0001 + Math.random() * 0.00012,
					amplitude: 0.025 + Math.random() * 0.055,
					driftXPhase: Math.random() * Math.PI * 2,
					driftYPhase: Math.random() * Math.PI * 2,
					driftXSpeed: 0.00008 + Math.random() * 0.00008,
					driftYSpeed: 0.00006 + Math.random() * 0.0001,
					driftAmplitude: 3.5 + Math.random() * 3
				});
			}
		}
		draw();
	}

	window.addEventListener("resize", () => {
		if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
		resizeFrame = requestAnimationFrame(() => {
			resizeFrame = null;
			resize();
		});
	}, { passive: true });
	window.addEventListener("pointermove", (event) => {
		if (event.pointerType === "touch") return;
		const x = event.clientX;
		const y = event.clientY;
		const time = performance.now();
		const moved = !pointer || !lastRipplePoint || Math.hypot(x - lastRipplePoint.x, y - lastRipplePoint.y) >= 16;
		pointer = { x, y };
		if (moved && time - lastRippleAt >= 100) emitRipple(x, y, time);
		if (reduceMotion) draw(time);
	}, { passive: true });
	window.addEventListener("pointerleave", clearPointer);
	window.addEventListener("blur", clearPointer);
	document.documentElement.addEventListener("pointerleave", clearPointer);
	document.addEventListener("visibilitychange", () => {
		if (document.hidden) clearPointer();
	});

	resize();
	if (!reduceMotion) requestAnimationFrame(animate);
})();