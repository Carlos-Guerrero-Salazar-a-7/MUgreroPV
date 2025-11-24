export const characterStates = {
    STANDING: 'standing',
    FOWARD: 'foward',
    BACK: 'back',
    CROUCH: 'crouch',
    JUMPING: 'jumping',
    JUMPING_FOWARD: 'jumping_foward',
    JUMPING_BACK: 'jumping_back',
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
    HURT: 'hurt',
    HURT_CROUCH: 'hurt_crouch',
};

// Estados que son ataques
export const ATTACK_STATES = new Set([
    characterStates.LIGHT_PUNCH,
    characterStates.MEDIUM_PUNCH,
    characterStates.LIGHT_KICK,
    characterStates.MEDIUM_KICK,
    characterStates.CROUCH_LIGHT_PUNCH,
    characterStates.CROUCH_MEDIUM_PUNCH,
    characterStates.CROUCH_LIGHT_KICK,
    characterStates.CROUCH_MEDIUM_KICK,
    characterStates.AIRING_LEFT,
    characterStates.AIRING_MIDDLE,
]);

// Estados donde el personaje está vulnerable (puede recibir daño)
export const VULNERABLE_STATES = new Set([
    characterStates.STANDING,
    characterStates.FOWARD,
    characterStates.BACK,
    characterStates.CROUCH,
    characterStates.JUMPING,
    characterStates.JUMPING_FOWARD,
    characterStates.JUMPING_BACK,
    ...ATTACK_STATES
]);

// Estados de daño/stun donde no puede atacar
export const HURT_STATES = new Set([
    characterStates.HURT,
    characterStates.HURT_CROUCH,
    ...ATTACK_STATES
]);

// Helper functions
export function isAttackState(state) {
    return ATTACK_STATES.has(state);
}

export function isVulnerable(state) {
    return VULNERABLE_STATES.has(state);
}

export function isHurtState(state) {
    return HURT_STATES.has(state);
}