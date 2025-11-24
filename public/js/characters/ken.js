import { Character } from './character.js';
import { characterStates } from './states/characterstates.js';

export class Ken extends Character {
    constructor(canvasWidth, canvasHeight, position = { x: 100, y: 300 }, size = { width: 100, height: 200 }, speed) {
        super(
            "Ken",
            position,
            "assets/characters/ken.png",
            size,
            canvasWidth,
            canvasHeight,
            speed,
            100, // health
        );
        
        this.frames = new Map([
            ['standing-1',[2, 529, 62, 91]],
            ['standing-2',[67, 529, 62, 91]],
            ['standing-3',[133, 526, 62, 92]],
            ['standing-4',[199, 522, 62, 95]],
            ['crouch-1',[16, 744, 58, 85]],
            ['crouch-2',[94, 759, 58, 69]],
            ['crouch-3',[171, 766, 62, 63]],
            ['forward-1',[18, 900, 64, 90]],
            ['forward-2',[96, 900, 64, 90]],
            ['forward-3',[169, 900, 64, 90]],
            ['forward-4',[259, 900, 64, 90]],
            ['forward-5',[343, 900, 65, 90]],
            ['back-1',[2, 1000, 63, 92]],
            ['back-2',[86, 1000, 63, 92]],
            ['back-3',[167, 1000, 63, 92]],
            ['back-4',[251, 1000, 63, 92]],
            ['back-5',[331, 1000, 63, 95]],
            ['back-6',[410, 1000, 63, 95]],
            ['jumping-1',[2, 1207, 58, 105]],
            ['jumping-2',[68, 1210, 58, 91]],
            ['jumping-3',[136, 1211, 58, 85]],
            ['jumping-4',[207, 1217, 58, 75]],
            ['jumping-5',[265, 1215, 58, 88]],
            ['jumping-6',[330, 1206, 58, 109]],
        ]);

        this.animations = new Map([
            [characterStates.STANDING, ['standing-1','standing-2','standing-3','standing-4']],
            [characterStates.BACK, ['back-1','back-2','back-3','back-4','back-5','back-6']],
            [characterStates.FOWARD, ['forward-1','forward-2','forward-3','forward-4','forward-5']],
            [characterStates.CROUCH, ['crouch-1','crouch-2','crouch-3']],
            [characterStates.JUMPING, ['jumping-1','jumping-2','jumping-3','jumping-4','jumping-5','jumping-6']],
            [characterStates.JUMPING_FOWARD, ['jumping-1','jumping-2','jumping-3','jumping-4','jumping-5','jumping-6']],
            [characterStates.JUMPING_BACK, ['jumping-1','jumping-2','jumping-3','jumping-4','jumping-5','jumping-6']],
        ]);
        
        this.animationsLimits = new Map([
            [characterStates.STANDING, 0.2],
            [characterStates.BACK, 0.25],
            [characterStates.CROUCH, 0.1],
            [characterStates.JUMPING, 0.2],
            [characterStates.JUMPING_FOWARD, 0.2],
            [characterStates.JUMPING_BACK, 0.2],
        ]);

        // Ken tiene los mismos ataques que Ryu por ahora
        // Puedes ajustar estos valores para diferenciarlo
        this.attackHitboxes = new Map([
            [characterStates.LIGHT_PUNCH, {
                damage: 5,
                knockback: { x: 100, y: 0 },
                hitstun: 0.3,
                activeFrames: [1],
                hitbox: { offsetX: 70, offsetY: -120, width: 80, height: 40 }
            }],
            [characterStates.MEDIUM_PUNCH, {
                damage: 10,
                knockback: { x: 180, y: 0 },
                hitstun: 0.5,
                activeFrames: [1],
                hitbox: { offsetX: 85, offsetY: -110, width: 100, height: 50 }
            }],
            [characterStates.LIGHT_KICK, {
                damage: 6,
                knockback: { x: 120, y: 0 },
                hitstun: 0.35,
                activeFrames: [1],
                hitbox: { offsetX: 60, offsetY: -90, width: 90, height: 60 }
            }],
            [characterStates.MEDIUM_KICK, {
                damage: 12,
                knockback: { x: 200, y: 0 },
                hitstun: 0.6,
                activeFrames: [1],
                hitbox: { offsetX: 80, offsetY: -95, width: 120, height: 50 }
            }],
            [characterStates.CROUCH_LIGHT_PUNCH, {
                damage: 4,
                knockback: { x: 80, y: 0 },
                hitstun: 0.25,
                activeFrames: [1],
                hitbox: { offsetX: 60, offsetY: -60, width: 70, height: 35 }
            }],
            [characterStates.CROUCH_MEDIUM_PUNCH, {
                damage: 8,
                knockback: { x: 110, y: 0 },
                hitstun: 0.4,
                activeFrames: [1],
                hitbox: { offsetX: 70, offsetY: -55, width: 90, height: 40 }
            }],
            [characterStates.CROUCH_LIGHT_KICK, {
                damage: 5,
                knockback: { x: 90, y: 0 },
                hitstun: 0.3,
                activeFrames: [1],
                hitbox: { offsetX: 65, offsetY: -40, width: 80, height: 30 }
            }],
            [characterStates.CROUCH_MEDIUM_KICK, {
                damage: 10,
                knockback: { x: 150, y: 0 },
                hitstun: 0.5,
                activeFrames: [1],
                hitbox: { offsetX: 85, offsetY: -35, width: 130, height: 35 }
            }],
            [characterStates.AIRING_LEFT, {
                damage: 7,
                knockback: { x: 100, y: -50 },
                hitstun: 0.4,
                activeFrames: [1],
                hitbox: { offsetX: 60, offsetY: -100, width: 85, height: 45 }
            }],
            [characterStates.AIRING_MIDDLE, {
                damage: 9,
                knockback: { x: 130, y: -80 },
                hitstun: 0.5,
                activeFrames: [1],
                hitbox: { offsetX: 65, offsetY: -95, width: 95, height: 50 }
            }]
        ]);
        
        this.animationTimeLimit = this.animationsLimits.get(characterStates.STANDING);
        this.facingDirection = -1; 
    }
}