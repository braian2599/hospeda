#!/bin/bash
# ═══════════════════════════════════════════════════════════
# Hospedá — Script de deploy a producción
# Uso: ./deploy.sh [deploy|migrate|logs|status|down|backup]
# ═══════════════════════════════════════════════════════════
set -euo pipefail

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

COMPOSE="docker compose --env-file .env.production"

log_info()  { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ── Pre-flight checks ──
check_env() {
    if [ ! -f .env.production ]; then
        log_error "No existe .env.production"
        log_info "Copiá .env.production.example a .env.production y completá los valores"
        cp .env.production.example .env.production
        log_ok "Creado .env.production — EDITALO ANTES DE CONTINUAR"
        exit 1
    fi

    # Verificar variables obligatorias
    source <(grep -v '^#' .env.production | grep -v '^$' | sed 's/=.*//' | while read var; do echo "$var="; done)
    local missing=()
    [ -z "${POSTGRES_PASSWORD:-}" ] && missing+=("POSTGRES_PASSWORD")
    [ -z "${NEXTAUTH_SECRET:-}" ] && missing+=("NEXTAUTH_SECRET")

    if [ ${#missing[@]} -gt 0 ]; then
        log_error "Faltan variables obligatorias en .env.production:"
        for v in "${missing[@]}"; do
            echo "  - $v"
        done
        log_info "Ejecutá estos comandos para generarlas:"
        echo '  openssl rand -hex 24  # para POSTGRES_PASSWORD'
        echo '  openssl rand -hex 32  # para NEXTAUTH_SECRET'
        exit 1
    fi

    log_ok "Variables de entorno verificadas"
}

# ── Comandos ──
cmd_deploy() {
    check_env
    log_info "Construyendo imágenes..."
    $COMPOSE build --parallel nextjs migrate
    log_ok "Imágenes construidas"

    log_info "Levantando servicios..."
    $COMPOSE up -d db nginx
    sleep 5

    log_info "Ejecutando migraciones + seed..."
    $COMPOSE up migrate

    log_info "Levantando app..."
    $COMPOSE up -d nextjs
    sleep 3

    log_ok "Deploy completado"
    echo ""
    $COMPOSE ps
}

cmd_migrate() {
    check_env
    log_info "Ejecutando migraciones..."
    $COMPOSE run --rm migrate
    log_ok "Migraciones completadas"
}

cmd_logs() {
    local service="${1:-nextjs}"
    $COMPOSE logs -f "$service"
}

cmd_status() {
    $COMPOSE ps
    echo ""
    $COMPOSE logs --tail=5 nextjs
}

cmd_down() {
    log_warn "Deteniendo todos los servicios..."
    $COMPOSE down
    log_ok "Servicios detenidos"
}

cmd_backup() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="backup_${timestamp}.sql"
    log_info "Creando backup de la base de datos..."
    $COMPOSE exec db pg_dump -U hospeda hospeda > "$backup_file"
    gzip "$backup_file"
    log_ok "Backup guardado: ${backup_file}.gz"
}

cmd_restart() {
    log_info "Reiniciando nextjs..."
    $COMPOSE restart nextjs
    log_ok "Restart completado"
}

# ── Main ──
case "${1:-deploy}" in
    deploy)   cmd_deploy ;;
    migrate)  cmd_migrate ;;
    logs)     cmd_logs "${2:-}" ;;
    status)   cmd_status ;;
    down)     cmd_down ;;
    backup)   cmd_backup ;;
    restart)  cmd_restart ;;
    *)
        echo "Uso: $0 {deploy|migrate|logs [service]|status|down|backup|restart}"
        echo ""
        echo "Comandos:"
        echo "  deploy   - Build + levantar todo (DB + migrate + app + nginx)"
        echo "  migrate  - Ejecutar migraciones Prisma + seed"
        echo "  logs     - Ver logs en vivo (nextjs, db, nginx, migrate)"
        echo "  status   - Estado de los contenedores"
        echo "  down     - Detener todos los servicios"
        echo "  backup   - Backup de la base de datos"
        echo "  restart  - Reiniciar el servicio nextjs"
        exit 1
        ;;
esac