import { characterStates, isAttackState, isVulnerable, isHurtState } from "./states/characterstates.js";

export class Character {
    constructor(name, position = { x: 100, y: 300 }, spritePath, size, canvasWidth, canvasHeight, speed = 5, health, portrait) {

        // Constructores
        this.name = name;
        this.position = position;
        this.size = size;
        this.width = size.width;
        this.height = size.height;
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.speed = speed * 60;
        this.maxHealth = health;
        this.health = health;
        this.frames = new Map();
        this.animations = new Map();
        this.currentState = characterStates.STANDING;
        this.portrait = portrait

        // Control de animación
        this.animationFrame = 0;
        this.animationTimer = 0;
        this.animationTimeLimit = 0.15;
        this.animationFinished = false;

        // Sistema de combate
        this.isInHitstun = false;
        this.hitstunTimer = 0;
        this.attackHitboxes = new Map(); // Configuración de hitboxes por ataque
        this.hasHitThisAttack = false; // Para evitar múltiples hits en el mismo ataque

        // Sistema de estados con lógica integrada
        this.states = {
            [characterStates.STANDING]: {
                init: () => {
                    this.velocity.speedx = 0;
                    this.height = this.normalHeight;
                    this.animationFinished = false;
                },
                update: () => { }
            },
            [characterStates.FOWARD]: {
                init: () => {
                    this.velocity.speedx = this.speed * this.facingDirection;
                    this.height = this.normalHeight;
                    this.animationFinished = false;
                },
                update: () => { }
            },
            [characterStates.BACK]: {
                init: () => {
                    this.velocity.speedx = -this.speed * this.facingDirection;
                    this.height = this.normalHeight;
                    this.animationFinished = false;
                },
                update: () => { }
            },
            [characterStates.CROUCH]: {
                init: () => {
                    this.velocity.speedx = 0;
                    this.height = this.size.height * 0.6;
                    this.animationFinished = false;
                },
                update: () => { }
            },
            [characterStates.JUMPING]: {
                init: () => {
                    if (!this.isJumping) {
                        this.velocity.speedy = this.jumpPower / 60;
                        this.isJumping = true;
                    }
                    this.height = this.normalHeight;
                    this.animationFinished = false;
                },
                update: () => { }
            },
            [characterStates.JUMPING_FOWARD]: {
                init: () => {
                    if (!this.isJumping) {
                        this.velocity.speedy = this.jumpPower / 60;
                        this.isJumping = true;
                    }
                    this.velocity.speedx = this.speed * this.facingDirection;
                    this.height = this.normalHeight;
                    this.animationFinished = false;
                },
                update: () => { }
            },
            [characterStates.JUMPING_BACK]: {
                init: () => {
                    if (!this.isJumping) {
                        this.velocity.speedy = this.jumpPower / 60;
                        this.isJumping = true;
                    }
                    this.velocity.speedx = this.speed * -this.facingDirection;
                    this.height = this.normalHeight;
                    this.animationFinished = false;
                },
                update: () => { }
            },
            // Estados de ataque - se detienen al terminar la animación
            [characterStates.LIGHT_PUNCH]: {
                init: () => {
                    this.velocity.speedx = 0;
                    this.animationFinished = false;
                    this.hasHitThisAttack = false;
                },
                update: () => { }
            },
            [characterStates.MEDIUM_PUNCH]: {
                init: () => {
                    this.velocity.speedx = 0;
                    this.animationFinished = false;
                    this.hasHitThisAttack = false;
                },
                update: () => { }
            },
            [characterStates.LIGHT_KICK]: {
                init: () => {
                    this.velocity.speedx = 0;
                    this.animationFinished = false;
                    this.hasHitThisAttack = false;
                },
                update: () => { }
            },
            [characterStates.MEDIUM_KICK]: {
                init: () => {
                    this.velocity.speedx = 0;
                    this.animationFinished = false;
                    this.hasHitThisAttack = false;
                },
                update: () => { }
            },
            [characterStates.CROUCH_LIGHT_PUNCH]: {
                init: () => {
                    this.velocity.speedx = 0;
                    this.height = this.size.height * 0.6;
                    this.animationFinished = false;
                    this.hasHitThisAttack = false;
                },
                update: () => { }
            },
            [characterStates.CROUCH_MEDIUM_PUNCH]: {
                init: () => {
                    this.velocity.speedx = 0;
                    this.height = this.size.height * 0.6;
                    this.animationFinished = false;
                    this.hasHitThisAttack = false;
                },
                update: () => { }
            },
            [characterStates.CROUCH_LIGHT_KICK]: {
                init: () => {
                    this.velocity.speedx = 0;
                    this.height = this.size.height * 0.6;
                    this.animationFinished = false;
                    this.hasHitThisAttack = false;
                },
                update: () => { }
            },
            [characterStates.CROUCH_MEDIUM_KICK]: {
                init: () => {
                    this.velocity.speedx = 0;
                    this.height = this.size.height * 0.6;
                    this.animationFinished = false;
                    this.hasHitThisAttack = false;
                },
                update: () => { }
            },
            [characterStates.AIRING_LEFT]: {
                init: () => {
                    this.animationFinished = false;
                    this.hasHitThisAttack = false;
                },
                update: () => { }
            },
            [characterStates.AIRING_MIDDLE]: {
                init: () => {
                    this.animationFinished = false;
                    this.hasHitThisAttack = false;
                },
                update: () => { }
            },
            [characterStates.HURT]: {
                init: () => {
                    this.velocity.speedx = 0;
                    this.animationFinished = false;
                },
                update: () => { }
            },
            [characterStates.HURT_CROUCH]: {
                init: () => {
                    this.velocity.speedx = 0;
                    this.height = this.size.height * 0.6;
                    this.animationFinished = false;
                },
                update: () => { }
            },
            // --- NUEVOS ESTADOS ---
            [characterStates.BLOCKING]: {
                init: () => {
                    this.velocity.speedx = -this.speed * 0.5 * this.facingDirection; // Moverse lento hacia atrás
                    this.height = this.normalHeight;
                    this.animationFinished = false;
                },
                update: () => {
                    // Mantener movimiento lento hacia atrás si se sigue presionando
                    if (this.facingDirection === 1 && this.moves.left) {
                        this.velocity.speedx = -this.speed * 0.5;
                    } else if (this.facingDirection === -1 && this.moves.right) {
                        this.velocity.speedx = this.speed * 0.5;
                    } else {
                        this.velocity.speedx = 0;
                    }
                }
            },
            [characterStates.CROUCH_BLOCKING]: {
                init: () => {
                    this.velocity.speedx = 0;
                    this.height = this.size.height * 0.6;
                    this.animationFinished = false;
                },
                update: () => { }
            },
            [characterStates.CROUCH_IDLE]: {
                init: () => {
                    this.velocity.speedx = 0;
                    this.height = this.size.height * 0.6;
                    this.animationFinished = false;
                },
                update: () => { }
            }
        };

        this.animationsLimits = new Map();

        // Animaciones que se reproducen solo una vez
        this.oneTimeAnimations = new Set([
            characterStates.CROUCH,
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
            characterStates.HURT,
            characterStates.HURT_CROUCH,
        ]);

        this.facingDirection = 1;

        // Cargar sprite
        this.sprite = new Image();
        this.spriteLoaded = false;
        this.sprite.onload = () => {
            this.spriteLoaded = true;
            console.log(`Sprite de ${this.name} cargado correctamente`);

            // Obtener el frame de referencia para calcular el factor de escala inicial
            // Este valor es solo de referencia y debe ser uno de los frames válidos (ej: standing-1)
            const standingFrame = this.frames.get('standing-1');
            if (standingFrame) {
                this.baseFrameWidth = standingFrame[2];
                this.baseFrameHeight = standingFrame[3];
            } else {
                // Valores de fallback si no existe 'standing-1' (debería existir)
                this.baseFrameWidth = 64;
                this.baseFrameHeight = 96;
                console.warn("No se encontró el frame 'standing-1' para calcular el factor de escala base.");
            }
        };
        this.sprite.onerror = () => {
            console.error(`Error al cargar sprite de ${this.name}: ${spritePath}`);
        };
        this.sprite.src = spritePath;

        this.frame = { x: 0, y: 0, width: 64, height: 96 };
        this.velocity = {
            speedx: 0,
            speedy: 0
        };

        // Control de movimiento
        this.moves = {
            up: false,
            down: false,
            left: false,
            right: false,
            kickone: false,
            punchone: false,
            kicktwo: false,
            punchtwo: false,
        };

        // Variables de salto
        this.gravity = 50 * 60;
        this.jumpPower = -1500 * 60;
        this.isJumping = false;
        this.normalHeight = this.height;
    }

    changeState(newState) {
        if (this.currentState !== newState) {
            this.currentState = newState;
            this.animationFrame = 0;
            this.animationTimer = 0;
            this.animationFinished = false;
            const stateBehavior = this.states[newState];
            if (stateBehavior && stateBehavior.init) {
                stateBehavior.init();
            }
        }
    }

    // Lógica de transición de estados basada en input
    handleStateTransitions() {
        // Si está en hitstun, no puede hacer nada
        if (this.isInHitstun) {
            return;
        }

        // Si está en un ataque y no ha terminado, no puede cambiar de estado
        // --- MODIFICACIÓN CLAVE: Permite la transición solo si la animación ya terminó ---
        // Esto previene que el jugador cancele la transición del ataque al estado deseado
        // antes de que se ejecute la lógica de reversión del ataque.
        if (isAttackState(this.currentState) && !this.animationFinished) {
            return;
        }

        // Si el ataque terminó, el estado actual es el que se estableció al final de la animación 
        // (STANDING o CROUCH). Ahora revisamos el input.

        let targetState = characterStates.STANDING; // Valor por defecto

        // Prioridad 1: Ataques (solo en el suelo)
        if (!this.isJumping) {
            if (this.moves.punchone) {
                if (this.moves.down) {
                    targetState = characterStates.CROUCH_LIGHT_PUNCH;
                } else {
                    targetState = characterStates.LIGHT_PUNCH;
                }
                this.changeState(targetState);
                return;
            }
            if (this.moves.punchtwo) {
                if (this.moves.down) {
                    targetState = characterStates.CROUCH_MEDIUM_PUNCH;
                } else {
                    targetState = characterStates.MEDIUM_PUNCH;
                }
                this.changeState(targetState);
                return;
            }
            if (this.moves.kickone) {
                if (this.moves.down) {
                    targetState = characterStates.CROUCH_LIGHT_KICK;
                } else {
                    targetState = characterStates.LIGHT_KICK;
                }
                this.changeState(targetState);
                return;
            }
            if (this.moves.kicktwo) {
                if (this.moves.down) {
                    targetState = characterStates.CROUCH_MEDIUM_KICK;
                } else {
                    targetState = characterStates.MEDIUM_KICK;
                }
                this.changeState(targetState);
                return;
            }
        } else {
            // Ataques en el aire
            if (this.moves.punchone || this.moves.kickone) {
                targetState = characterStates.AIRING_LEFT;
                this.changeState(targetState);
                return;
            }
            if (this.moves.punchtwo || this.moves.kicktwo) {
                targetState = characterStates.AIRING_MIDDLE;
                this.changeState(targetState);
                return;
            }
        }

        // Prioridad 2: Salto (solo si no está saltando ya)
        if (this.moves.up && !this.isJumping) {
            if (this.moves.left) {
                targetState = (this.facingDirection === 1) ? characterStates.JUMPING_BACK : characterStates.JUMPING_FOWARD;
            } else if (this.moves.right) {
                targetState = (this.facingDirection === 1) ? characterStates.JUMPING_FOWARD : characterStates.JUMPING_BACK;
            } else {
                targetState = characterStates.JUMPING;
            }
        }
        // Prioridad 3: Si ya está en el aire, mantener estado de salto
        else if (this.isJumping) {
            return;
        }
        // Prioridad 4: Agacharse y Bloqueo Bajo
        else if (this.moves.down) {
            // Verificar bloqueo bajo (Down + Back)
            const isHoldingBack = (this.facingDirection === 1 && this.moves.left) ||
                (this.facingDirection === -1 && this.moves.right);

            if (isHoldingBack) {
                targetState = characterStates.CROUCH_BLOCKING;
            } else {
                // Si ya estaba agachado (CROUCH o CROUCH_IDLE), mantener CROUCH_IDLE para no reiniciar animación
                if (this.currentState === characterStates.CROUCH ||
                    this.currentState === characterStates.CROUCH_IDLE ||
                    this.currentState === characterStates.CROUCH_BLOCKING) {
                    targetState = characterStates.CROUCH_IDLE;
                } else {
                    targetState = characterStates.CROUCH;
                }
            }
        }
        // Prioridad 5: Movimiento horizontal y Bloqueo Alto
        else if (this.moves.left) {
            if (this.facingDirection === 1) {
                targetState = characterStates.BLOCKING; // Caminar hacia atrás = Bloqueo
            } else {
                targetState = characterStates.FOWARD;
            }
        }
        else if (this.moves.right) {
            if (this.facingDirection === -1) {
                targetState = characterStates.BLOCKING; // Caminar hacia atrás = Bloqueo
            } else {
                targetState = characterStates.FOWARD;
            }
        }
        // Prioridad 6: Standing por defecto
        else {
            targetState = characterStates.STANDING;
        }

        this.changeState(targetState);
    }

    updateCanvasSize(newWidth, newHeight) {
        this.canvasWidth = newWidth;
        this.canvasHeight = newHeight;
        if (this.position.y > this.canvasHeight) {
            this.position.y = this.canvasHeight;
        }
    }

    updateFacingDirection(opponent) {
        if (!opponent) return;
        if (opponent.position.x > this.position.x) {
            this.facingDirection = 1;
        }
        else if (opponent.position.x < this.position.x) {
            this.facingDirection = -1;
        }
    }

    checkGroundCollision(opponent) {
        const myX = this.position.x;
        const myY = this.position.y;

        const oppX = opponent.position.x;
        const oppY = opponent.position.y;

        const collisionRadius = (this.size.width * 0.4) / 2;
        const oppCollisionRadius = (opponent.size.width * 0.4) / 2;

        const horizontalDistance = Math.abs(myX - oppX);
        const minDistance = collisionRadius + oppCollisionRadius;
        const horizontalOverlap = horizontalDistance < minDistance;

        const groundTolerance = 5;
        const myOnGround = Math.abs(myY - this.canvasHeight) < groundTolerance;
        const oppOnGround = Math.abs(oppY - this.canvasHeight) < groundTolerance;

        return horizontalOverlap && myOnGround && oppOnGround;
    }

    // Obtener la hurtbox (área vulnerable)
    getHurtbox() {
        // Reducir el área vulnerable ligeramente para más precisión
        const hurtboxWidth = this.size.width * 0.7;
        const hurtboxHeight = this.height * 0.9;

        return {
            x: this.position.x - (hurtboxWidth / 2),
            y: this.position.y - hurtboxHeight,
            width: hurtboxWidth,
            height: hurtboxHeight,
            centerX: this.position.x,
            centerY: this.position.y - (hurtboxHeight / 2),
        };
    }

    // Obtener la hitbox de ataque (si existe en el frame actual)
    getAttackHitbox() {
        if (!isAttackState(this.currentState)) {
            return null;
        }

        const attackConfig = this.attackHitboxes.get(this.currentState);
        if (!attackConfig) {
            return null;
        }

        // Verificar si el frame actual tiene hitbox activa
        if (!attackConfig.activeFrames.includes(this.animationFrame)) {
            return null;
        }

        // Si ya golpeó en este ataque, no volver a golpear
        if (this.hasHitThisAttack) {
            return null;
        }

        const hitbox = attackConfig.hitbox;
        const offsetX = hitbox.offsetX * this.facingDirection;

        return {
            x: this.position.x + offsetX - (hitbox.width / 2),
            y: this.position.y + hitbox.offsetY,
            width: hitbox.width,
            height: hitbox.height,
            damage: attackConfig.damage,
            knockback: {
                x: attackConfig.knockback.x * this.facingDirection,
                y: attackConfig.knockback.y
            },
            hitstun: attackConfig.hitstun
        };
    }

    // Detectar colisión entre dos cajas
    checkBoxCollision(box1, box2) {
        if (!box1 || !box2) return false;

        return box1.x < box2.x + box2.width &&
            box1.x + box1.width > box2.x &&
            box1.y < box2.y + box2.height &&
            box1.y + box1.height > box2.y;
    }

    // Recibir daño
    takeDamage(positionenemy, positionyou, damage, knockback, hitstun) {
        let finalDamage = damage;
        let finalHitstun = hitstun;
        let isBlocking = false;

        // Verificar si está bloqueando
        if (this.currentState === characterStates.BLOCKING ||
            this.currentState === characterStates.CROUCH_BLOCKING) {

            // Lógica simplificada: Si está en estado de bloqueo, bloquea todo.
            // (En un juego real, habría que verificar High/Low vs Overhead/Low)
            isBlocking = true;
            finalDamage = damage * 0.2; // 20% del daño (80% reducción)
            finalHitstun = hitstun * 0.5; // 50% del hitstun
            console.log(`${this.name} BLOQUEÓ el ataque! Daño reducido a ${finalDamage}`);
        }

        this.health -= finalDamage;
        if (this.health < 0) this.health = 0;
        positionenemy.x -= knockback.x;
        positionyou.x += knockback.x;

        // Entrar en hitstun
        this.isInHitstun = true;
        this.hitstunTimer = finalHitstun;

        // Cambiar a estado hurt (o mantener bloqueo visualmente si se desea, 
        // pero por ahora usamos HURT para feedback visual del impacto, aunque sea reducido)
        // MEJORA: Si bloquea, podríamos no cambiar a HURT o tener una animación de "Block Hit".
        // Por ahora, mantenemos la lógica de ir a HURT pero con menos tiempo.

        if (this.currentState === characterStates.CROUCH ||
            this.currentState.includes('crouch') ||
            this.currentState === characterStates.CROUCH_BLOCKING) {
            this.changeState(characterStates.HURT_CROUCH);
        } else {
            this.changeState(characterStates.HURT);
        }

        console.log(`${this.name} recibió ${finalDamage} de daño. Salud: ${this.health}`);
    }

    update(secondspassed, opponent) {
        // Actualizar hitstun
        if (this.isInHitstun) {
            this.hitstunTimer -= secondspassed;
            if (this.hitstunTimer <= 0) {
                this.isInHitstun = false;
                this.hitstunTimer = 0;
                // Volver a standing cuando termine el hitstun
                if (isHurtState(this.currentState)) {
                    this.changeState(characterStates.STANDING);
                }
            }
        }

        // Procesar transiciones de estado basadas en input
        this.handleStateTransitions();

        // Actualizar comportamiento del estado actual
        const stateBehavior = this.states[this.currentState];
        if (stateBehavior && stateBehavior.update) {
            stateBehavior.update(secondspassed, opponent);
        }

        // Animación
        const currentAnimationFrames = this.animations.get(this.currentState);
        const animationToUse = currentAnimationFrames ? currentAnimationFrames : this.animations.get(characterStates.STANDING);
        const totalFrames = animationToUse ? animationToUse.length : 1;

        const isOneTimeAnimation = this.oneTimeAnimations.has(this.currentState);

        if (!this.animationFinished || !isOneTimeAnimation) {
            this.animationTimer += secondspassed;
            const currentAnimationTimeLimit = (this.animationsLimits.get(this.currentState))
                ? this.animationsLimits.get(this.currentState)
                : this.animationTimeLimit;

            if (this.animationTimer >= currentAnimationTimeLimit) {
                this.animationFrame = (this.animationFrame + 1);

                if (isOneTimeAnimation && this.animationFrame >= totalFrames) {
                    this.animationFrame = totalFrames - 1;
                    this.animationFinished = true;

                    if (isAttackState(this.currentState) && !this.isJumping) {
                        // --- LÓGICA DE REVERSIÓN DE ATAQUE CORREGIDA ---
                        const wasCrouchAttack = this.currentState.includes('crouch');

                        if (wasCrouchAttack) {
                            // Si era un ataque agachado, verificamos si sigue manteniendo abajo
                            if (this.moves.down) {
                                // Transición suave a CROUCH_IDLE para evitar reinicio
                                this.changeState(characterStates.CROUCH_IDLE);
                            } else {
                                this.changeState(characterStates.STANDING);
                            }
                        }
                        else {
                            // Ataques de pie siempre vuelven a STANDING
                            this.changeState(characterStates.STANDING);
                        }

                        return;
                    }

                } else if (!isOneTimeAnimation) {
                    this.animationFrame = this.animationFrame % totalFrames;
                }
                this.animationTimer = 0;
            }
        }

        // Detección de golpes
        if (opponent && isAttackState(this.currentState) && !this.hasHitThisAttack) {
            const myHitbox = this.getAttackHitbox();
            const opponentHurtbox = opponent.getHurtbox();
            if (this.checkBoxCollision(myHitbox, opponentHurtbox) && !opponent.isInHitstun) {
                opponent.takeDamage(this.position, opponent.position, myHitbox.damage, myHitbox.knockback, myHitbox.hitstun);
                this.hasHitThisAttack = true;
            }
        }

        // Física de gravedad
        this.velocity.speedy += this.gravity * secondspassed;

        const previousX = this.position.x;
        const wasJumpingBeforeUpdate = this.isJumping;

        // Actualizar posición
        this.position.x += this.velocity.speedx * secondspassed;
        this.position.y += this.velocity.speedy * secondspassed;

        // Colisión con el suelo
        if (this.position.y >= this.canvasHeight) {
            this.position.y = this.canvasHeight;
            this.velocity.speedy = 0;

            const justLanded = wasJumpingBeforeUpdate && this.isJumping;
            this.isJumping = false;

            if (this.currentState === characterStates.JUMPING ||
                this.currentState === characterStates.JUMPING_FOWARD ||
                this.currentState === characterStates.JUMPING_BACK ||
                this.currentState === characterStates.AIRING_LEFT ||
                this.currentState === characterStates.AIRING_MIDDLE) {
                this.changeState(characterStates.STANDING);
            }

            if (justLanded && this.checkGroundCollision(opponent)) {
                if (this.position.x > opponent.position.x) {
                    this.facingDirection = -1;
                    this.position.x = opponent.position.x + (opponent.size.width / 2 + this.size.width / 2);
                } else {
                    this.facingDirection = 1;
                    this.position.x = opponent.position.x - (opponent.size.width / 2 + this.size.width / 2);
                }
            }
        }

        // Colisión horizontal en el suelo (solo si no está en hitstun)
        if (!this.isInHitstun && this.checkGroundCollision(opponent) && !this.isJumping) {
            this.position.x = previousX;
            this.velocity.speedx = 0;
        } else if (this.isJumping || opponent.isJumping) {
            this.updateFacingDirection(opponent);
        } else {
            this.updateFacingDirection(opponent);
        }

        // Límites del canvas
        const leftX = this.position.x - (this.size.width / 2);
        const rightX = this.position.x + (this.size.width / 2);

        if (leftX < 0) {
            this.position.x = this.size.width / 2;
        }
        if (rightX > this.canvasWidth) {
            this.position.x = this.canvasWidth - (this.size.width / 2);
        }
    }

    draw(ctx) {
        const currentAnimationFrames = this.animations.get(this.currentState);
        const animationToUse = currentAnimationFrames ? currentAnimationFrames : this.animations.get(characterStates.STANDING);
        const frameIndex = this.animationFrame % (animationToUse ? animationToUse.length : 1);
        const frameKey = animationToUse ? animationToUse[frameIndex] : 'standing-1';
        const frameData = this.frames.get(frameKey);

        if (!frameData) {
            console.error(`Frame key no encontrado: ${frameKey}`);
            this.frame = this.frames.get('standing-1');
        } else {
            this.frame = {
                x: frameData[0],
                y: frameData[1],
                width: frameData[2],
                height: frameData[3]
            };
        }

        // --- CORRECCIÓN FINAL DE ESCALA ---

        // 1. Calcular el factor de escala LÓGICO (basado en la altura de pie) para mantener la consistencia visual.
        const baseScaleFactor = (this.baseFrameHeight && this.baseFrameHeight > 0)
            ? this.normalHeight / this.baseFrameHeight
            : 1.0;

        // 2. Definir el ancho y alto de dibujo con el factor de escala base.
        let drawWidth = this.frame.width * baseScaleFactor;
        let drawHeight = this.frame.height * baseScaleFactor;

        // 3. COMPROMISO: Si la altura escalada del frame es mayor que la altura LÓGICA 
        // del personaje en este estado (this.height, ej: 120 al agacharse),
        // recalculamos la escala para forzar que la altura del dibujo coincida con la altura lógica.
        // Esto evita que el sprite se "salga" de la Hurtbox en estados bajos.
        if (drawHeight > this.height) {
            // Recalcular la escala basándose en la altura LÓGICA ACTUAL.
            const newScaleFactor = this.height / this.frame.height;
            drawWidth = this.frame.width * newScaleFactor;
            drawHeight = this.frame.height * newScaleFactor;
        }

        // 4. La posición Y de destino (Dest Y) es simplemente -drawHeight relativo al punto de anclaje (this.position.y).
        const destY = -drawHeight;

        // --- FIN DE LA CORRECCIÓN ---

        if (this.spriteLoaded) {
            ctx.save();
            // Trasladar al centro inferior del personaje (punto de anclaje)
            ctx.translate(this.position.x, this.position.y);

            if (this.facingDirection === 1) {
                ctx.scale(-1, 1);
            }
            ctx.drawImage(
                this.sprite,
                this.frame.x,
                this.frame.y,
                this.frame.width,
                this.frame.height,
                -drawWidth / 2, // Dest X: centrado
                destY, // Dest Y: anclado a la base
                drawWidth,
                drawHeight
            );

            ctx.restore();
        } else {
            // Dibujo de fallback si el sprite no carga
            const rectX = this.position.x - (this.size.width / 2);
            const rectY = this.position.y - this.height; // Usar this.height para el fallback
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(rectX, rectY, this.size.width, this.height);
        }

        // Dibujar hurtbox (azul)
        const hurtbox = this.getHurtbox();
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.strokeRect(hurtbox.x, hurtbox.y, hurtbox.width, hurtbox.height);

        // Dibujar hitbox de ataque (rojo) si existe
        const hitbox = this.getAttackHitbox();
        if (hitbox) {
            ctx.strokeStyle = '#ff0000';
            ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.fillRect(hitbox.x, hitbox.y, hitbox.width, hitbox.height);
            ctx.strokeRect(hitbox.x, hitbox.y, hitbox.width, hitbox.height);
        }

        // Debug visual
        ctx.fillStyle = '#00ff00';
        ctx.beginPath();
        ctx.arc(this.position.x, this.position.y, 5, 0, Math.PI * 2);
        ctx.fill();

        // Estado y salud
        ctx.fillStyle = this.isInHitstun ? '#ff0000' : '#ffff00';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`${this.currentState} | HP: ${this.health}`, this.position.x, this.position.y - this.height - 10);
    }

    getHitbox() {
        return this.getHurtbox();
    }
}