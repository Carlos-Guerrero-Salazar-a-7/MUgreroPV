import { Character } from './character.js';
import { characterStates } from './states/characterstates.js';

export class Ryu extends Character {
    constructor(canvasWidth, canvasHeight, position = { x: 100, y: 300 }, size = { width: 100, height: 200 }, speed) {
        super(
            "Ryu",
            position,
            "assets/characters/ryu.png",
            size,
            canvasWidth,
            canvasHeight,
            speed,
            100, // health
            { offsetX: 32, offsetY: 268, width: 100, height: 100 } // portrait
        );

        this.frames = new Map([
            ['standing-1', [2, 905, 62, 90]],
            ['standing-2', [67, 905, 62, 90]],
            ['standing-3', [132, 905, 62, 90]],
            ['standing-4', [198, 905, 62, 90]],
            ['crouch-1', [18, 1126, 54, 83]],
            ['crouch-2', [94, 1120, 57, 83]],
            ['crouch-3', [170, 1148, 68, 61]],
            ['forward-1', [18, 1280, 64, 90]],
            ['forward-2', [96, 1280, 64, 90]],
            ['forward-3', [169, 1280, 64, 90]],
            ['forward-4', [259, 1280, 64, 90]],
            ['forward-6', [333, 1280, 65, 90]],
            ['back-1', [2, 1375, 62, 92]],
            ['back-2', [86, 1375, 62, 92]],
            ['back-3', [169, 1375, 62, 92]],
            ['back-4', [251, 1375, 62, 92]],
            ['back-5', [331, 1375, 62, 95]],
            ['back-6', [412, 1375, 62, 95]],
            ['jumping-1', [2, 1588, 55, 105]],
            ['jumping-2', [68, 1588, 55, 104]],
            ['jumping-3', [136, 1588, 55, 104]],
            ['jumping-4', [207, 1588, 55, 104]],
            ['jumping-5', [265, 1590, 51, 104]],
            ['jumping-6', [323, 1583, 62, 109]],
            ['punch-L-1', [39, 1797, 70, 90]],
            ['punch-L-2', [127, 1797, 97, 90]],
            ['punch-M-1', [175, 1890, 77, 96]],
            ['punch-M-2', [268, 1890, 112, 95]],
            ['crouch-PL-1', [35, 2327, 68, 65]],
            ['crouch-PL-2', [119, 2327, 101, 63]],
            ['crouch-PM-1', [146, 2393, 70, 61]],
            ['crouch-PM-2', [235, 2391, 92, 66]],
            ['kick-L-1', [46, 2956, 54, 86]],
            ['kick-L-2', [105, 2956, 84, 98]],
            ['kick-M-1', [41, 2763, 66, 94]],
            ['kick-M-2', [141, 2763, 123, 95]],
            ['crouch-KL-1', [69, 3364, 56, 48]],
            ['crouch-KL-2', [41, 3299, 97, 62]],
            ['crouch-KM-1', [169, 3307, 168, 54]],
            ['airing-l-1', [35, 2327, 68, 65]],
            ['airing-l-2', [119, 2327, 101, 63]],
            ['airing-m-1', [146, 2393, 70, 61]],
            ['airing-m-2', [235, 2391, 92, 66]],
            ['hurt', [107, 4505, 66, 83]],
            ['hurt-crouch', [96, 4428, 54, 66]],
            ['portrait', [32, 268, 100, 100]],
        ]);

        this.animations = new Map([
            [characterStates.STANDING, ['standing-1', 'standing-2', 'standing-3', 'standing-4']],
            [characterStates.BACK, ['back-1', 'back-2', 'back-3', 'back-4', 'back-5', 'back-6']],
            [characterStates.FOWARD, ['forward-1', 'forward-2', 'forward-3', 'forward-4', 'forward-6']],
            [characterStates.CROUCH, ['crouch-1', 'crouch-2', 'crouch-3']],
            [characterStates.CROUCH_IDLE, ['crouch-3']],
            [characterStates.BLOCKING, ['back-1', 'back-2', 'back-3', 'back-4', 'back-5', 'back-6']],
            [characterStates.CROUCH_BLOCKING, ['crouch-3']],
            [characterStates.JUMPING, ['jumping-1', 'jumping-2', 'jumping-3', 'jumping-4', 'jumping-5', 'jumping-6']],
            [characterStates.JUMPING_FOWARD, ['jumping-1', 'jumping-2', 'jumping-3', 'jumping-4', 'jumping-5', 'jumping-6']],
            [characterStates.JUMPING_BACK, ['jumping-1', 'jumping-2', 'jumping-3', 'jumping-4', 'jumping-5', 'jumping-6']],
            [characterStates.LIGHT_PUNCH, ['punch-L-1', 'punch-L-2']],
            [characterStates.MEDIUM_PUNCH, ['punch-M-1', 'punch-M-2']],
            [characterStates.LIGHT_KICK, ['kick-L-1', 'kick-L-2']],
            [characterStates.MEDIUM_KICK, ['kick-M-1', 'kick-M-2']],
            [characterStates.CROUCH_LIGHT_PUNCH, ['crouch-PL-1', 'crouch-PL-2']],
            [characterStates.CROUCH_MEDIUM_PUNCH, ['crouch-PM-1', 'crouch-PM-2']],
            [characterStates.CROUCH_LIGHT_KICK, ['crouch-KL-1', 'crouch-KL-2']],
            [characterStates.CROUCH_MEDIUM_KICK, ['crouch-KL-1', 'crouch-KM-1']],
            [characterStates.AIRING_LEFT, ['airing-l-1', 'airing-l-2']],
            [characterStates.AIRING_MIDDLE, ['airing-m-1', 'airing-m-2']],
            [characterStates.HURT, ['hurt']],
            [characterStates.HURT_CROUCH, ['hurt-crouch']],
        ]);

        this.animationsLimits = new Map([
            [characterStates.STANDING, 0.2],
            [characterStates.BACK, 0.25],
            [characterStates.CROUCH, 0.1],
            [characterStates.CROUCH_IDLE, 0.2],
            [characterStates.JUMPING, 0.15],
            [characterStates.JUMPING_FOWARD, 0.15],
            [characterStates.JUMPING_BACK, 0.15],
            [characterStates.LIGHT_PUNCH, 0.08],
            [characterStates.MEDIUM_PUNCH, 0.12],
            [characterStates.LIGHT_KICK, 0.08],
            [characterStates.MEDIUM_KICK, 0.12],
            [characterStates.CROUCH_LIGHT_PUNCH, 0.08],
            [characterStates.CROUCH_MEDIUM_PUNCH, 0.12],
            [characterStates.CROUCH_LIGHT_KICK, 0.08],
            [characterStates.CROUCH_MEDIUM_KICK, 0.12],
            [characterStates.AIRING_LEFT, 0.1],
            [characterStates.AIRING_MIDDLE, 0.1],
            [characterStates.HURT, 0.15],
            [characterStates.HURT_CROUCH, 0.15],
        ]);

        // Configuración de hitboxes para cada ataque
        // offsetX y offsetY son relativos a position (centro-bottom del personaje)
        this.attackHitboxes = new Map([
            [characterStates.LIGHT_PUNCH, {
                damage: 5,
                knockback: { x: 100, y: 0 },
                hitstun: 0.3,
                activeFrames: [1],
                hitbox: { offsetX: canvasWidth * 0.05, offsetY: -canvasHeight * 0.3, width: canvasWidth * 0.1, height: canvasHeight * 0.1 }
            }],
            [characterStates.MEDIUM_PUNCH, {
                damage: 10,
                knockback: { x: 180, y: 0 },
                hitstun: 0.5,
                activeFrames: [1],
                hitbox: { offsetX: canvasWidth * 0.05, offsetY: -canvasHeight * 0.3, width: canvasWidth * 0.15, height: canvasHeight * 0.1 }
            }],
            [characterStates.LIGHT_KICK, {
                damage: 6,
                knockback: { x: 120, y: 0 },
                hitstun: 0.35,
                activeFrames: [1],
                hitbox: { offsetX: canvasWidth * 0.05, offsetY: -canvasHeight * 0.15, width: canvasWidth * 0.10, height: canvasHeight * 0.05 }
            }],
            [characterStates.MEDIUM_KICK, {
                damage: 12,
                knockback: { x: 200, y: 0 },
                hitstun: 0.6,
                activeFrames: [1],
                hitbox: { offsetX: canvasWidth * 0.05, offsetY: -canvasHeight * 0.15, width: canvasWidth * 0.20, height: canvasHeight * 1 }
            }],
            [characterStates.CROUCH_LIGHT_PUNCH, {
                damage: 4,
                knockback: { x: 80, y: 0 },
                hitstun: 0.25,
                activeFrames: [1],
                hitbox: { offsetX: canvasWidth * 0.05, offsetY: -canvasHeight * 0.15, width: canvasWidth * 0.10, height: canvasHeight * 0.05 }
            }],
            [characterStates.CROUCH_MEDIUM_PUNCH, {
                damage: 8,
                knockback: { x: 110, y: 0 },
                hitstun: 0.4,
                activeFrames: [1],
                hitbox: { offsetX: canvasWidth * 0.05, offsetY: -canvasHeight * 0.15, width: canvasWidth * 0.12, height: canvasHeight * 0.06 }
            }],
            [characterStates.CROUCH_LIGHT_KICK, {
                damage: 5,
                knockback: { x: 90, y: 0 },
                hitstun: 0.3,
                activeFrames: [1],
                hitbox: { offsetX: canvasWidth * 0.05, offsetY: -canvasHeight * 0.10, width: canvasWidth * 0.10, height: canvasHeight * 0.05 }
            }],
            [characterStates.CROUCH_MEDIUM_KICK, {
                damage: 10,
                knockback: { x: 150, y: 0 },
                hitstun: 0.5,
                activeFrames: [1],
                hitbox: { offsetX: canvasWidth * 0.05, offsetY: -canvasHeight * 0.10, width: canvasWidth * 0.13, height: canvasHeight * 0.06 }
            }],
            [characterStates.AIRING_LEFT, {
                damage: 7,
                knockback: { x: 100, y: -50 },
                hitstun: 0.4,
                activeFrames: [1],
                hitbox: { offsetX: canvasWidth * 0.05, offsetY: -canvasHeight * 0.50, width: canvasWidth * 0.10, height: canvasHeight * 0.10 }
            }],
            [characterStates.AIRING_MIDDLE, {
                damage: 9,
                knockback: { x: 130, y: -80 },
                hitstun: 0.5,
                activeFrames: [1],
                hitbox: { offsetX: canvasWidth * 0.05, offsetY: -canvasHeight * 0.50, width: canvasWidth * 0.12, height: canvasHeight * 0.10 }
            }]
        ]);

        this.animationTimeLimit = this.animationsLimits.get(characterStates.STANDING);
        this.facingDirection = 1;
    }
}