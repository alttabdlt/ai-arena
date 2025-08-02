import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

interface LootboxParticlesProps {
  type: 'explosion' | 'celebration';
  color: string;
}

export const LootboxParticles: React.FC<LootboxParticlesProps> = ({ type, color }) => {
  const particles = useMemo(() => {
    if (type === 'explosion') {
      // Radial explosion particles
      return [...Array(40)].map((_, i) => {
        const angle = (i / 40) * Math.PI * 2;
        const velocity = 300 + Math.random() * 200;
        const size = 4 + Math.random() * 4;
        
        return {
          id: i,
          x: Math.cos(angle) * velocity,
          y: Math.sin(angle) * velocity,
          size,
          duration: 1 + Math.random() * 0.5,
          delay: Math.random() * 0.1
        };
      });
    } else {
      // Celebration confetti
      return [...Array(60)].map((_, i) => {
        const side = Math.random() > 0.5 ? 1 : -1;
        const x = side * (200 + Math.random() * 100);
        const y = -300 - Math.random() * 200;
        
        return {
          id: i,
          x,
          y: -y, // Fall downward
          size: 6 + Math.random() * 4,
          rotation: Math.random() * 360,
          duration: 2 + Math.random(),
          delay: Math.random() * 0.5
        };
      });
    }
  }, [type]);
  
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute top-1/2 left-1/2"
          initial={{
            x: 0,
            y: 0,
            scale: 0,
            opacity: 1
          }}
          animate={{
            x: particle.x,
            y: particle.y,
            scale: [0, 1, 1, 0],
            opacity: [0, 1, 1, 0],
            rotate: type === 'celebration' ? particle.rotation : 0
          }}
          transition={{
            duration: particle.duration,
            delay: particle.delay,
            ease: type === 'explosion' ? 'easeOut' : 'easeIn'
          }}
        >
          {type === 'explosion' ? (
            // Spark/star shape
            <div
              className="relative"
              style={{
                width: particle.size,
                height: particle.size
              }}
            >
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  backgroundColor: color,
                  boxShadow: `0 0 ${particle.size * 2}px ${color}`
                }}
              />
              {/* Star points */}
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="absolute top-1/2 left-1/2"
                  style={{
                    width: 2,
                    height: particle.size * 2,
                    backgroundColor: color,
                    transform: `translate(-50%, -50%) rotate(${i * 45}deg)`,
                    opacity: 0.8
                  }}
                />
              ))}
            </div>
          ) : (
            // Confetti rectangle
            <div
              style={{
                width: particle.size,
                height: particle.size * 1.5,
                backgroundColor: color,
                borderRadius: 2,
                transform: `rotate(${particle.rotation}deg)`
              }}
            />
          )}
        </motion.div>
      ))}
      
      {/* Additional glow effect for explosion */}
      {type === 'explosion' && (
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          initial={{
            scale: 0,
            opacity: 1
          }}
          animate={{
            scale: [0, 3, 5],
            opacity: [1, 0.5, 0]
          }}
          transition={{
            duration: 1,
            ease: 'easeOut'
          }}
        >
          <div
            className="w-96 h-96 rounded-full"
            style={{
              background: `radial-gradient(circle, ${color}40 0%, transparent 70%)`,
              filter: 'blur(20px)'
            }}
          />
        </motion.div>
      )}
      
      {/* Light rays for legendary items */}
      {color === '#F59E0B' && type === 'celebration' && (
        <>
          {[...Array(12)].map((_, i) => (
            <motion.div
              key={`ray-${i}`}
              className="absolute top-1/2 left-1/2"
              style={{
                width: 2,
                height: 600,
                background: `linear-gradient(to bottom, transparent, ${color}60, transparent)`,
                transformOrigin: 'center top'
              }}
              initial={{
                rotate: i * 30,
                scaleY: 0,
                opacity: 0
              }}
              animate={{
                scaleY: [0, 1, 1, 0],
                opacity: [0, 1, 1, 0],
                rotate: i * 30 + 360
              }}
              transition={{
                duration: 3,
                delay: i * 0.05,
                ease: 'easeInOut'
              }}
            />
          ))}
        </>
      )}
    </div>
  );
};