import React, { useEffect, useRef, useState } from 'react';

const SignaturePad = ({ value, onChange, label, isDarkMode }) => {
    const canvasRef = useRef(null);
    const drawingRef = useRef(false);
    const [hasInk, setHasInk] = useState(Boolean(value));

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return undefined;

        const context = canvas.getContext('2d');
        context.clearRect(0, 0, canvas.width, canvas.height);
        if (!value) {
            setHasInk(false);
            return undefined;
        }

        const image = new Image();
        image.onload = () => {
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            setHasInk(true);
        };
        image.onerror = () => setHasInk(false);
        image.src = value;

        return () => {
            image.onload = null;
            image.onerror = null;
        };
    }, [value]);

    const point = (event) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        return { x: (event.clientX - rect.left) * (canvas.width / rect.width), y: (event.clientY - rect.top) * (canvas.height / rect.height) };
    };
    const start = (event) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        event.preventDefault();
        canvas.setPointerCapture?.(event.pointerId);
        const ctx = canvas.getContext('2d');
        const p = point(event);
        ctx.beginPath(); ctx.moveTo(p.x, p.y);
        ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111827';
        drawingRef.current = true;
    };
    const move = (event) => {
        if (!drawingRef.current) return;
        event.preventDefault();
        const ctx = canvasRef.current.getContext('2d');
        const p = point(event);
        ctx.lineTo(p.x, p.y); ctx.stroke();
        setHasInk(true);
    };
    const stop = () => {
        if (!drawingRef.current) return;
        drawingRef.current = false;
        onChange(canvasRef.current.toDataURL('image/png'));
    };
    const clear = () => {
        const canvas = canvasRef.current;
        if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
        setHasInk(false); onChange('');
    };

    return (
        <div>
            <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-sm font-bold">{label}</span>
                <button type="button" onClick={clear} className="text-xs font-semibold text-blue-600">다시 서명</button>
            </div>
            <canvas ref={canvasRef} width={720} height={220} aria-label={label}
                onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop}
                className={`w-full h-28 rounded-lg border border-dashed touch-none ${isDarkMode ? 'bg-white border-slate-500' : 'bg-slate-50 border-slate-300'}`} />
            {!hasInk && <p className="mt-1 text-xs text-slate-500">손가락으로 위 영역에 직접 서명하세요.</p>}
        </div>
    );
};
export default SignaturePad;
