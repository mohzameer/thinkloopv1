import { Box } from '@mantine/core'

interface NoteDotProps {
  x: number
  y: number
  onClick: () => void
  isActive?: boolean
  isSelected?: boolean
}

export function NoteDot({ x, y, onClick, isActive = false, isSelected = false }: NoteDotProps) {
    return (
        <>
            <Box
                onClick={onClick}
                style={{
                    position: 'absolute',
                    left: `${x}px`,
                    top: `${y}px`,
                    width: '16px',
                    height: '16px',
                    transform: 'translate(-50%, -50%)',
                    cursor: 'pointer',
                    zIndex: 10
                }}
            >
                {/* Outer glow ring */}
                <Box
                    style={{
                        position: 'absolute',
                        width: '32px',
                        height: '32px',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        borderRadius: '50%',
                        background: isSelected
              ? 'radial-gradient(circle, rgba(239, 68, 68, 0.5) 0%, rgba(239, 68, 68, 0.2) 40%, rgba(239, 68, 68, 0) 70%)'
              : 'radial-gradient(circle, rgba(59, 130, 246, 0.5) 0%, rgba(59, 130, 246, 0.2) 40%, rgba(59, 130, 246, 0) 70%)',
                        animation: 'pulse-glow-outer 1.2s ease-in-out infinite',
                        pointerEvents: 'none'
                    }}
                />

                {/* Middle glow ring */}
                <Box
                    style={{
                        position: 'absolute',
                        width: '24px',
                        height: '24px',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        borderRadius: '50%',
                        background: isSelected
              ? 'radial-gradient(circle, rgba(239, 68, 68, 0.4) 0%, rgba(239, 68, 68, 0.15) 50%, rgba(239, 68, 68, 0) 70%)'
              : 'radial-gradient(circle, rgba(59, 130, 246, 0.4) 0%, rgba(59, 130, 246, 0.15) 50%, rgba(59, 130, 246, 0) 70%)',
                        animation: 'pulse-glow-middle 1s ease-in-out 0.2s infinite',
                        pointerEvents: 'none'
                    }}
                />

                {/* Inner glow ring */}
                <Box
                    style={{
                        position: 'absolute',
                        width: '18px',
                        height: '18px',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        borderRadius: '50%',
                        background: isSelected
              ? 'radial-gradient(circle, rgba(239, 68, 68, 0.6) 0%, rgba(239, 68, 68, 0) 60%)'
              : 'radial-gradient(circle, rgba(59, 130, 246, 0.6) 0%, rgba(59, 130, 246, 0) 60%)',
                        animation: 'pulse-glow-inner 0.8s ease-in-out 0.1s infinite',
                        pointerEvents: 'none'
                    }}
                />

                {/* Core dot */}
                <Box
                    style={{
                        position: 'absolute',
                        width: '12px',
                        height: '12px',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        borderRadius: '50%',
                        backgroundColor: isSelected ? '#ef4444' : '#3b82f6',
                        boxShadow: isSelected
                            ? '0 0 16px rgba(239, 68, 68, 1), 0 0 24px rgba(239, 68, 68, 0.8), 0 0 32px rgba(239, 68, 68, 0.6)'
                            : isActive
                            ? '0 0 16px rgba(59, 130, 246, 1), 0 0 24px rgba(59, 130, 246, 0.8), 0 0 32px rgba(59, 130, 246, 0.6)'
                            : '0 0 10px rgba(59, 130, 246, 0.8), 0 0 20px rgba(59, 130, 246, 0.6), 0 0 30px rgba(59, 130, 246, 0.4)',
                        animation: isActive ? 'pulse-core-active 0.6s ease-in-out infinite' : 'pulse-core 1s ease-in-out infinite',
                        transition: 'all 0.3s ease',
                        pointerEvents: 'none'
                    }}
                />
            </Box>

            <style>
                {`
          @keyframes pulse-glow-outer {
            0%, 100% {
              opacity: 0.3;
              transform: translate(-50%, -50%) scale(1);
            }
            50% {
              opacity: 0.7;
              transform: translate(-50%, -50%) scale(1.4);
            }
          }
          
          @keyframes pulse-glow-middle {
            0%, 100% {
              opacity: 0.4;
              transform: translate(-50%, -50%) scale(1);
            }
            50% {
              opacity: 0.8;
              transform: translate(-50%, -50%) scale(1.3);
            }
          }
          
          @keyframes pulse-glow-inner {
            0%, 100% {
              opacity: 0.5;
              transform: translate(-50%, -50%) scale(1);
            }
            50% {
              opacity: 0.9;
              transform: translate(-50%, -50%) scale(1.2);
            }
          }
          
          @keyframes pulse-core {
            0%, 100% {
              opacity: 0.9;
              transform: translate(-50%, -50%) scale(1);
            }
            50% {
              opacity: 1;
              transform: translate(-50%, -50%) scale(1.1);
            }
          }
          
          @keyframes pulse-core-active {
            0%, 100% {
              opacity: 1;
              transform: translate(-50%, -50%) scale(1);
            }
            50% {
              opacity: 1;
              transform: translate(-50%, -50%) scale(1.15);
            }
          }
        `}
            </style>
        </>
    )
}

