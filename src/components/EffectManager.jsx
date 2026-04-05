import React, { useEffect, useRef, useState } from 'react';

/**
 * 티어별 파티클 효과를 관리하는 Canvas 컴포넌트
 */
export default function EffectManager({ trigger, tier, pos }) {
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);
  const requestRef = useRef(null);

  useEffect(() => {
    if (!trigger || !tier) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Canvas 크기 맞춤
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // 파티클 생성 로직 (Tier별 분기)
    createParticles(tier, pos);

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particlesRef.current = particlesRef.current.filter(p => p.life > 0);
      particlesRef.current.forEach(p => {
        p.update();
        p.draw(ctx);
      });

      if (particlesRef.current.length > 0) {
        requestRef.current = requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(requestRef.current);
  }, [trigger, tier, pos]);

  const createParticles = (tier, pos) => {
    const { x, y } = pos || { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const count = tier === 't4' || tier === 't5' ? 40 : tier === 't3' ? 15 : 8;
    
    for (let i = 0; i < count; i++) {
      particlesRef.current.push(new Particle(x, y, tier));
    }
  };

  return <canvas ref={canvasRef} className="particle-canvas" />;
}

class Particle {
  constructor(x, y, tier) {
    this.x = x;
    this.y = y;
    this.tier = tier;
    this.size = Math.random() * 4 + 2;
    this.speedX = (Math.random() - 0.5) * 10;
    this.speedY = (Math.random() - 0.5) * 10;
    this.life = 1.0;
    this.decay = Math.random() * 0.02 + 0.01;
    this.gravity = tier === 't4' || tier === 't5' ? 0.15 : 0;
    this.color = this.getColor();
    this.char = tier === 't5' && Math.random() > 0.5 ? '🍀' : tier === 't3' ? '★' : null;
  }

  getColor() {
    switch (this.tier) {
      case 't1': return '#22c55e'; // Green
      case 't2': return '#3b82f6'; // Blue
      case 't3': return '#eab308'; // Yellow/Star
      case 't4': 
      case 't5': {
        const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6'];
        return colors[Math.floor(Math.random() * colors.length)];
      }
      default: return '#ffffff';
    }
  }

  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    this.speedY += this.gravity;
    this.life -= this.decay;
  }

  draw(ctx) {
    ctx.globalAlpha = this.life;
    if (this.char) {
      ctx.font = `${this.size * 5}px Arial`;
      ctx.fillText(this.char, this.x, this.y);
    } else {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;
  }
}
