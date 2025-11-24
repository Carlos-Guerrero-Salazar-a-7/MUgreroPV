// attackstates.js - Define los estados de ataque y sus propiedades

export const attackStates = {
    LIGHT_PUNCH: 'light_punch',
    MEDIUM_PUNCH: 'medium_punch',
    LIGHT_KICK: 'light_kick',
    MEDIUM_KICK: 'medium_kick',
    CROUCH_LIGHT_PUNCH: 'crouch_light_punch',
    CROUCH_MEDIUM_PUNCH: 'crouch_medium_punch',
    CROUCH_LIGHT_KICK: 'crouch_light_kick',
    CROUCH_MEDIUM_KICK: 'crouch_medium_kick',
    AIRING_LEFT: 'airing_left',
    AIRING_MIDDLE: 'airing_middle',
};

// Configuración de hitboxes por ataque
// Cada ataque define sus hitboxes activas en frames específicos
export const attackHitboxes = {
    [attackStates.LIGHT_PUNCH]: {
        damage: 5,
        knockback: { x: 100, y: 0 },
        hitstun: 0.3, // segundos de stun
        activeFrames: [1], // Frame donde está activa la hitbox (índice del array de animación)
        hitbox: { offsetX: 60, offsetY: -120, width: 80, height: 40 } // Relativo a position
    },
    [attackStates.MEDIUM_PUNCH]: {
        damage: 10,
        knockback: { x: 150, y: 0 },
        hitstun: 0.5,
        activeFrames: [1],
        hitbox: { offsetX: 70, offsetY: -110, width: 100, height: 50 }
    },
    [attackStates.LIGHT_KICK]: {
        damage: 6,
        knockback: { x: 120, y: 0 },
        hitstun: 0.35,
        activeFrames: [1],
        hitbox: { offsetX: 50, offsetY: -80, width: 90, height: 60 }
    },
    [attackStates.MEDIUM_KICK]: {
        damage: 12,
        knockback: { x: 180, y: 0 },
        hitstun: 0.6,
        activeFrames: [1, 2],
        hitbox: { offsetX: 60, offsetY: -90, width: 120, height: 50 }
    },
    [attackStates.CROUCH_LIGHT_PUNCH]: {
        damage: 4,
        knockback: { x: 80, y: 0 },
        hitstun: 0.25,
        activeFrames: [1],
        hitbox: { offsetX: 50, offsetY: -60, width: 70, height: 35 }
    },
    [attackStates.CROUCH_MEDIUM_PUNCH]: {
        damage: 8,
        knockback: { x: 100, y: 0 },
        hitstun: 0.4,
        activeFrames: [1, 2],
        hitbox: { offsetX: 60, offsetY: -55, width: 90, height: 40 }
    },
    [attackStates.CROUCH_LIGHT_KICK]: {
        damage: 5,
        knockback: { x: 90, y: 0 },
        hitstun: 0.3,
        activeFrames: [1],
        hitbox: { offsetX: 55, offsetY: -40, width: 80, height: 30 }
    },
    [attackStates.CROUCH_MEDIUM_KICK]: {
        damage: 10,
        knockback: { x: 130, y: 0 },
        hitstun: 0.5,
        activeFrames: [1, 2],
        hitbox: { offsetX: 65, offsetY: -35, width: 110, height: 35 }
    },
    [attackStates.AIRING_LEFT]: {
        damage: 7,
        knockback: { x: 100, y: -50 },
        hitstun: 0.4,
        activeFrames: [1],
        hitbox: { offsetX: 50, offsetY: -100, width: 85, height: 45 }
    },
    [attackStates.AIRING_MIDDLE]: {
        damage: 9,
        knockback: { x: 120, y: -80 },
        hitstun: 0.5,
        activeFrames: [1],
        hitbox: { offsetX: 55, offsetY: -95, width: 95, height: 50 }
    }
};

// Helper para verificar si un estado es de ataque
export function isAttackState(state) {
    return Object.values(attackStates).includes(state);
}

// Helper para obtener configuración de ataque
export function getAttackConfig(state) {
    return attackHitboxes[state] || null;
}