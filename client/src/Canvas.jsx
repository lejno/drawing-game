import { useEffect, useRef, useState } from "react";
import { reqClearDrawing, reqDrawStroke, reqUndoStroke } from "./client";

function drawStroke(ctx, stroke) {
  ctx.lineWidth = stroke.lineWidth;
  ctx.lineCap = "round";
  ctx.strokeStyle = stroke.color;
  ctx.beginPath();
  ctx.moveTo(stroke.x0, stroke.y0);
  ctx.lineTo(stroke.x1, stroke.y1);
  ctx.stroke();
}

export default function Canvas({ roomId, drawingData }) {
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef(null);
  const currentStrokeIdRef = useRef(null);
  const prevLengthRef = useRef(0);
  const [color, setColor] = useState("#111111");
  const [lineWidth, setLineWidth] = useState(3);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    if (drawingData.length < prevLengthRef.current) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawingData.forEach((stroke) => drawStroke(ctx, stroke));
      prevLengthRef.current = drawingData.length;
      return;
    }

    for (let i = prevLengthRef.current; i < drawingData.length; i += 1) {
      drawStroke(ctx, drawingData[i]);
    }
    prevLengthRef.current = drawingData.length;
  }, [drawingData]);

  function getPoint(event) {
    const canvas = canvasRef.current;
    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  function handlePointerDown(event) {
    const point = getPoint(event);
    if (!point) {
      return;
    }

    isDrawingRef.current = true;
    lastPointRef.current = point;
    currentStrokeIdRef.current = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;
  }

  function handlePointerMove(event) {
    if (!isDrawingRef.current) {
      return;
    }

    const point = getPoint(event);
    const lastPoint = lastPointRef.current;
    if (!point || !lastPoint) {
      return;
    }

    const stroke = {
      x0: lastPoint.x,
      y0: lastPoint.y,
      x1: point.x,
      y1: point.y,
      color,
      lineWidth,
      strokeId: currentStrokeIdRef.current,
    };

    reqDrawStroke(stroke, roomId);
    lastPointRef.current = point;
  }

  function handlePointerUp() {
    isDrawingRef.current = false;
    lastPointRef.current = null;
    currentStrokeIdRef.current = null;
  }

  function handleClear() {
    reqClearDrawing(roomId);
  }

  function handleUndo() {
    reqUndoStroke(roomId);
  }

  useEffect(() => {
    function handleKeyDown(event) {
      const isUndo = event.key.toLowerCase() === "z";
      const hasUndoModifier = event.ctrlKey || event.metaKey;

      if (!isUndo || !hasUndoModifier) {
        return;
      }

      event.preventDefault();
      reqUndoStroke(roomId);
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [roomId]);

  return (
    <div>
      <div>
        <label htmlFor="color">Color</label>
        <input
          id="color"
          type="color"
          value={color}
          onChange={(event) => setColor(event.target.value)}
        />
        <label htmlFor="lineWidth">Width</label>
        <input
          id="lineWidth"
          type="range"
          min="1"
          max="20"
          value={lineWidth}
          onChange={(event) => setLineWidth(Number(event.target.value))}
        />
        <button type="button" onClick={handleClear}>
          Clear
        </button>
        <button type="button" onClick={handleUndo}>
          Undo
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={900}
        height={500}
        style={{ border: "1px solid #ccc", touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
    </div>
  );
}
