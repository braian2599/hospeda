"""
Plan de Mejoras de Seguridad — Hospedá
PDF generado con ReportLab, paleta alineada con el sistema (teal-700).
"""
import os
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm, cm
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
    KeepTogether, HRFlowable, ListFlowable, ListItem
)
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# ═══════════════════════════════════════════════════════════
# PALETA — alineada con el sistema Hospedá (teal-700 / emerald)
# ═══════════════════════════════════════════════════════════

# XL tier: backgrounds
PAGE_BG       = colors.HexColor('#F8FAFC')
SECTION_BG    = colors.HexColor('#F1F5F9')

# L tier: surfaces
CARD_BG       = colors.HexColor('#ECFDF5')  # emerald-50
TABLE_STRIPE  = colors.HexColor('#F0FDFA')  # teal-50

# M tier: structural fills (teal oscuro)
HEADER_FILL   = colors.HexColor('#0F766E')   # teal-700 (PRIMARY del sistema)
COVER_BLOCK   = colors.HexColor('#134E4A')   # teal-900

# S tier: edges & icons
BORDER        = colors.HexColor('#CCFBF1')   # teal-100
ICON          = colors.HexColor('#0D9488')   # teal-600

# XS tier: emphasis
ACCENT        = colors.HexColor('#14B8A6')   # teal-500
ACCENT_2      = colors.HexColor('#4ADE80')   # brand-mint

# Typography
TEXT_PRIMARY  = colors.HexColor('#0F172A')   # slate-900
TEXT_MUTED    = colors.HexColor('#64748B')   # slate-500

# Semantic
SEM_SUCCESS   = colors.HexColor('#059669')
SEM_WARNING   = colors.HexColor('#D97706')
SEM_ERROR     = colors.HexColor('#DC2626')
SEM_INFO      = colors.HexColor('#0284C7')

# Table colors
TABLE_HEADER_COLOR = HEADER_FILL
TABLE_HEADER_TEXT  = colors.white
TABLE_ROW_EVEN     = colors.white
TABLE_ROW_ODD      = TABLE_STRIPE


# ═══════════════════════════════════════════════════════════
# FUENTES
# ═══════════════════════════════════════════════════════════

# Intentar registrar fuentes; si no están, usar Helvetica
FONT_REGULAR = 'Helvetica'
FONT_BOLD = 'Helvetica-Bold'
FONT_ITALIC = 'Helvetica-Oblique'

# Buscar fuentes del sistema
font_paths = [
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
]
if all(os.path.exists(p) for p in font_paths):
    try:
        pdfmetrics.registerFont(TTFont('DejaVu', font_paths[0]))
        pdfmetrics.registerFont(TTFont('DejaVu-Bold', font_paths[1]))
        FONT_REGULAR = 'DejaVu'
        FONT_BOLD = 'DejaVu-Bold'
    except Exception:
        pass


# ═══════════════════════════════════════════════════════════
# ESTILOS DE PÁRRAFO
# ═══════════════════════════════════════════════════════════

styles = getSampleStyleSheet()

style_h1 = ParagraphStyle(
    'H1', parent=styles['Heading1'],
    fontName=FONT_BOLD, fontSize=18, leading=24,
    textColor=HEADER_FILL, spaceBefore=20, spaceAfter=10,
    keepWithNext=True,
)

style_h2 = ParagraphStyle(
    'H2', parent=styles['Heading2'],
    fontName=FONT_BOLD, fontSize=14, leading=18,
    textColor=COVER_BLOCK, spaceBefore=14, spaceAfter=6,
    keepWithNext=True,
)

style_h3 = ParagraphStyle(
    'H3', parent=styles['Heading3'],
    fontName=FONT_BOLD, fontSize=11, leading=15,
    textColor=ICON, spaceBefore=10, spaceAfter=4,
    keepWithNext=True,
)

style_body = ParagraphStyle(
    'Body', parent=styles['Normal'],
    fontName=FONT_REGULAR, fontSize=10, leading=14,
    textColor=TEXT_PRIMARY, spaceAfter=6, alignment=TA_JUSTIFY,
)

style_body_muted = ParagraphStyle(
    'BodyMuted', parent=style_body,
    textColor=TEXT_MUTED, fontSize=9,
)

style_bullet = ParagraphStyle(
    'Bullet', parent=style_body,
    leftIndent=18, bulletIndent=6, spaceAfter=3,
)

style_callout = ParagraphStyle(
    'Callout', parent=style_body,
    fontSize=10, leading=14, textColor=HEADER_FILL,
    backColor=CARD_BG, borderPadding=8, leftIndent=8, rightIndent=8,
    spaceBefore=8, spaceAfter=8,
)

style_kicker = ParagraphStyle(
    'Kicker', parent=styles['Normal'],
    fontName=FONT_BOLD, fontSize=9, leading=12,
    textColor=ACCENT, spaceAfter=4,
)


# ═══════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════

def hr():
    return HRFlowable(
        width='100%', thickness=0.5, color=BORDER,
        spaceBefore=8, spaceAfter=8
    )

def section_title(text):
    return Paragraph(text, style_h1)

def subsection_title(text):
    return Paragraph(text, style_h2)

def small_title(text):
    return Paragraph(text, style_h3)

def body(text):
    return Paragraph(text, style_body)

def body_muted(text):
    return Paragraph(text, style_body_muted)

def callout(text):
    return Paragraph(text, style_callout)

def kicker(text):
    return Paragraph(text.upper(), style_kicker)

def bullets(items, style=None):
    s = style or style_bullet
    return ListFlowable(
        [ListItem(Paragraph(item, s), leftIndent=18, value='circle') for item in items],
        bulletType='bullet', start='circle',
    )


# ═══════════════════════════════════════════════════════════
# TABLA DE MEJORAS
# ═══════════════════════════════════════════════════════════

def improvements_table(rows):
    """rows: list of [#, Mejora, Prioridad, Esfuerzo, Impacto]"""
    header = ['#', 'Mejora', 'Prioridad', 'Esfuerzo', 'Impacto']
    data = [header] + rows

    # Convertir celdas a Paragraph para wrapping
    para_data = []
    for i, row in enumerate(data):
        para_row = []
        for j, cell in enumerate(row):
            if i == 0:
                # Header
                para_row.append(Paragraph(
                    f'<font color="white"><b>{cell}</b></font>',
                    ParagraphStyle('th', fontName=FONT_BOLD, fontSize=8, leading=10,
                                   textColor=colors.white, alignment=TA_CENTER)
                ))
            else:
                # Body
                align = TA_CENTER if j in (0, 2, 3, 4) else TA_LEFT
                color = TEXT_PRIMARY
                if j == 2:  # Prioridad
                    if 'Crítica' in cell:
                        color = SEM_ERROR
                    elif 'Importante' in cell:
                        color = SEM_WARNING
                    elif 'Hardening' in cell:
                        color = SEM_INFO
                para_row.append(Paragraph(
                    cell,
                    ParagraphStyle('td', fontName=FONT_REGULAR, fontSize=8, leading=11,
                                   textColor=color, alignment=align)
                ))
        para_data.append(para_row)

    # Column widths (A4 width = 595pt, margins = 36pt each side → 523pt usable)
    col_widths = [25, 280, 70, 70, 80]

    t = Table(para_data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        # Header
        ('BACKGROUND', (0, 0), (-1, 0), TABLE_HEADER_COLOR),
        ('TEXTCOLOR', (0, 0), (-1, 0), TABLE_HEADER_TEXT),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        ('VALIGN', (0, 0), (-1, 0), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, 0), 6),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
        # Body
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [TABLE_ROW_EVEN, TABLE_ROW_ODD]),
        ('VALIGN', (0, 1), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 1), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        # Borders
        ('LINEBELOW', (0, 0), (-1, 0), 1, HEADER_FILL),
        ('LINEBELOW', (0, 1), (-1, -1), 0.3, BORDER),
        ('BOX', (0, 0), (-1, -1), 0.5, BORDER),
    ]))
    return t


# ═══════════════════════════════════════════════════════════
# PORTADA
# ═══════════════════════════════════════════════════════════

def cover_page(canvas_obj, doc):
    """Dibuja la portada en la primera página."""
    w, h = A4

    # Fondo teal full-bleed
    canvas_obj.setFillColor(COVER_BLOCK)
    canvas_obj.rect(0, 0, w, h, fill=1, stroke=0)

    # Gradiente simulado con rectángulos superpuestos (teal más claro abajo)
    for i in range(20):
        alpha = 0.05 * i
        canvas_obj.setFillColorRGB(0.058, 0.466, 0.431, alpha=alpha)  # teal-500
        canvas_obj.rect(0, 0, w, h * (1 - i * 0.04), fill=1, stroke=0)

    # Blobs decorativos
    canvas_obj.setFillColor(ACCENT_2)
    canvas_obj.setFillAlpha(0.15)
    canvas_obj.circle(w * 0.15, h * 0.85, 120, fill=1, stroke=0)

    canvas_obj.setFillColor(ACCENT)
    canvas_obj.setFillAlpha(0.2)
    canvas_obj.circle(w * 0.85, h * 0.15, 100, fill=1, stroke=0)

    canvas_obj.setFillAlpha(1)

    # Logo "H" en cuadrado blanco
    canvas_obj.setFillColor(colors.white)
    canvas_obj.roundRect(w/2 - 28, h - 180, 56, 56, 12, fill=1, stroke=0)
    canvas_obj.setFillColor(HEADER_FILL)
    canvas_obj.setFont(FONT_BOLD, 28)
    canvas_obj.drawCentredString(w/2, h - 170, 'H')

    # Título principal
    canvas_obj.setFillColor(colors.white)
    canvas_obj.setFont(FONT_BOLD, 32)
    canvas_obj.drawCentredString(w/2, h - 250, 'Plan de Mejoras')

    canvas_obj.setFont(FONT_BOLD, 32)
    canvas_obj.drawCentredString(w/2, h - 285, 'de Seguridad')

    # Subtítulo
    canvas_obj.setFillColor(colors.HexColor('#5EEAD4'))  # teal-300
    canvas_obj.setFont(FONT_REGULAR, 14)
    canvas_obj.drawCentredString(w/2, h - 320, 'Auditoría completa del sistema Hospedá')

    # Tags
    tags = ['Hardening', 'Anti-fraude', 'Defensa en profundidad']
    tag_y = h - 360
    tag_x_start = w/2 - 140
    for i, tag in enumerate(tags):
        x = tag_x_start + i * 95
        canvas_obj.setFillColor(colors.white)
        canvas_obj.setFillAlpha(0.15)
        canvas_obj.roundRect(x, tag_y, 85, 22, 11, fill=1, stroke=0)
        canvas_obj.setFillAlpha(1)
        canvas_obj.setFillColor(colors.white)
        canvas_obj.setFont(FONT_REGULAR, 8)
        canvas_obj.drawCentredString(x + 42, tag_y + 7, tag)

    # Caja con número clave
    box_y = 200
    canvas_obj.setFillColor(colors.white)
    canvas_obj.setFillAlpha(0.1)
    canvas_obj.roundRect(w/2 - 150, box_y, 300, 90, 8, fill=1, stroke=0)
    canvas_obj.setFillAlpha(1)

    canvas_obj.setFillColor(colors.white)
    canvas_obj.setFont(FONT_BOLD, 36)
    canvas_obj.drawCentredString(w/2, box_y + 50, '20')

    canvas_obj.setFillColor(colors.HexColor('#5EEAD4'))
    canvas_obj.setFont(FONT_REGULAR, 10)
    canvas_obj.drawCentredString(w/2, box_y + 25, 'mejoras identificadas')
    canvas_obj.setFillColor(colors.white)
    canvas_obj.setFillAlpha(0.7)
    canvas_obj.setFont(FONT_REGULAR, 8)
    canvas_obj.drawCentredString(w/2, box_y + 10, '5 críticas · 7 importantes · 8 hardening')

    # Footer
    canvas_obj.setFillColor(colors.white)
    canvas_obj.setFillAlpha(0.5)
    canvas_obj.setFont(FONT_REGULAR, 9)
    canvas_obj.drawCentredString(w/2, 40, 'Hospedá · Documento interno · 2026')


def header_footer(canvas_obj, doc):
    """Header y footer para páginas de contenido."""
    w, h = A4
    canvas_obj.saveState()

    # Header line
    canvas_obj.setStrokeColor(BORDER)
    canvas_obj.setLineWidth(0.5)
    canvas_obj.line(40, h - 40, w - 40, h - 40)

    canvas_obj.setFillColor(TEXT_MUTED)
    canvas_obj.setFont(FONT_REGULAR, 8)
    canvas_obj.drawString(40, h - 32, 'Plan de Mejoras de Seguridad — Hospedá')
    canvas_obj.drawRightString(w - 40, h - 32, f'Página {doc.page}')

    # Footer
    canvas_obj.setStrokeColor(BORDER)
    canvas_obj.line(40, 40, w - 40, 40)
    canvas_obj.setFillColor(TEXT_MUTED)
    canvas_obj.setFont(FONT_REGULAR, 8)
    canvas_obj.drawCentredString(w/2, 25, 'Documento confidencial · Uso interno')

    canvas_obj.restoreState()


# ═══════════════════════════════════════════════════════════
# CONTENIDO
# ═══════════════════════════════════════════════════════════

def build_story():
    story = []

    # ── Resumen ejecutivo ──
    story.append(section_title('Resumen ejecutivo'))
    story.append(body(
        'Este documento detalla las <b>20 mejoras de seguridad</b> identificadas tras una '
        'auditoría exhaustiva del sistema Hospedá. Las mejoras están organizadas por '
        'prioridad: <b>5 críticas</b> (mitigan vectores de ataque reales), <b>7 importantes</b> '
        '(defensa en profundidad) y <b>8 de hardening</b> (resiliencia y monitoreo).'
    ))
    story.append(body(
        'El sistema ya cuenta con varias protecciones implementadas: validación de monto en '
        'webhooks de Mercado Pago, rate limiting en endpoints sensibles, CSP headers, '
        'validación de tenant activo, y auditoría de cambios del super-admin. Las mejoras '
        'propuestas complementan estas defensas existentes.'
    ))
    story.append(callout(
        '<b>Recomendación:</b> Implementar primero las 5 mejoras críticas (Fase 1), '
        'que mitigan los riesgos más altos con menor esfuerzo. Las fases 2 y 3 '
        'pueden ejecutarse en paralelo sin depender de la 1.'
    ))

    # ── Tabla resumen ──
    story.append(section_title('Tabla de mejoras'))
    story.append(body_muted('Listado completo con prioridad, esfuerzo estimado e impacto.'))

    rows = [
        ['1', 'Rate limiting distribuido (Redis)', 'Crítica', 'Medio', 'Previene fuerza bruta'],
        ['2', 'Configurar Resend (email service)', 'Crítica', 'Bajo', 'register/forgot-password funcionan'],
        ['3', 'Rate limit global en middleware', 'Crítica', 'Medio', 'Previene DoS'],
        ['4', 'Cifrar credenciales MP en BD', 'Crítica', 'Medio', 'Protege MP si roban BD'],
        ['5', 'Validar IP en webhook MP', 'Crítica', 'Bajo', 'Capa extra en webhook'],
        ['6', 'Sentry (monitoreo de errores)', 'Importante', 'Bajo', 'Detección de ataques'],
        ['7', 'Error messages genéricos', 'Importante', 'Bajo', 'No filtra info interna'],
        ['8', 'Quitar stack trace log', 'Importante', 'Trivial', 'No loggea tokens'],
        ['9', 'Eliminar auto-migrate.ts', 'Importante', 'Trivial', 'Quita SQL raw peligroso'],
        ['10', 'Zod para validación de inputs', 'Importante', 'Alto', 'Type-safe inputs'],
        ['11', 'CSRF tokens en mutations', 'Importante', 'Medio', 'Previene CSRF'],
        ['12', 'Google OAuth config en prod', 'Importante', 'Bajo', 'Login Google funciona'],
        ['13', 'Backup automático de BD', 'Hardening', 'Medio', 'Recuperación ante desastre'],
        ['14', 'Health check endpoint', 'Hardening', 'Bajo', 'Uptime monitoring'],
        ['15', 'IP + User Agent en auditoría', 'Hardening', 'Bajo', 'Forenses post-ataque'],
        ['16', 'Dependabot (deps auto-update)', 'Hardening', 'Trivial', 'Parches automáticos'],
        ['17', 'CSP report-uri', 'Hardening', 'Bajo', 'Detección de XSS'],
        ['18', 'Rotación de NEXTAUTH_SECRET', 'Hardening', 'Trivial', 'Mitiga secret filtrado'],
        ['19', '2FA para super-admin', 'Hardening', 'Medio', 'Protege panel admin'],
        ['20', 'Headers adicionales (COOP, COEP)', 'Hardening', 'Trivial', 'Defense in depth'],
    ]
    story.append(improvements_table(rows))

    story.append(PageBreak())

    # ── Fase 1: Críticas ──
    story.append(section_title('Fase 1 — Mejoras críticas'))
    story.append(body(
        'Estas 5 mejoras mitigan los vectores de ataque más probables y de mayor impacto. '
        'Se recomienda implementarlas primero, idealmente en 1-2 días.'
    ))

    # 1
    story.append(small_title('1. Rate limiting distribuido (Redis)'))
    story.append(kicker('Prioridad crítica · Esfuerzo medio'))
    story.append(body(
        '<b>Problema:</b> El rate limiter actual usa <font face="Courier">Map()</font> en memoria. '
        'En Vercel, cada serverless function es una instancia separada, así que un atacante '
        'tiene 10 intentos por instancia. Con 10 instancias paralelas = 100 intentos por ventana.'
    ))
    story.append(body(
        '<b>Fix:</b> Migrar a Upstash Redis (plan free) o Vercel KV. Cambiar '
        '<font face="Courier">rateLimitStore = new Map()</font> por '
        '<font face="Courier">await redis.incr(key)</font>. Beneficio: 1 solo contador compartido '
        'entre todas las instancias. Costo: $0 (free tier).'
    ))

    # 2
    story.append(small_title('2. Configurar Resend (email service)'))
    story.append(kicker('Prioridad crítica · Esfuerzo bajo'))
    story.append(body(
        '<b>Problema:</b> <font face="Courier">RESEND_API_KEY</font> no está en .env. Los emails '
        'de verificación y reseteo de contraseña no se envían en producción. Los usuarios no '
        'pueden verificar su cuenta ni recuperar contraseña.'
    ))
    story.append(body(
        '<b>Fix:</b> Crear cuenta en resend.com, agregar '
        '<font face="Courier">RESEND_API_KEY</font> y '
        '<font face="Courier">RESEND_FROM_DOMAIN</font> a Vercel env vars, y verificar el dominio.'
    ))

    # 3
    story.append(small_title('3. Rate limit global en middleware'))
    story.append(kicker('Prioridad crítica · Esfuerzo medio'))
    story.append(body(
        '<b>Problema:</b> Solo 9 de 73 endpoints tienen <font face="Courier">rateLimit()</font>. '
        'Los otros 64 (reservas, caja, configuración, reportes) pueden recibir requests '
        'ilimitadas → DoS, fuerza bruta de operaciones, scraping.'
    ))
    story.append(body(
        '<b>Fix:</b> Crear <font face="Courier">middleware.ts</font> que aplique a todas las '
        '<font face="Courier">/api/*</font>. Configurar límites por tipo: mutaciones 30 req/min '
        'por usuario, queries 100 req/min, endpoints públicos 10 req/min por IP.'
    ))

    # 4
    story.append(small_title('4. Cifrar credenciales MP en BD'))
    story.append(kicker('Prioridad crítica · Esfuerzo medio'))
    story.append(body(
        '<b>Problema:</b> <font face="Courier">PlatformConfig</font> guarda '
        '<font face="Courier">mp_access_token</font> y '
        '<font face="Courier">mp_webhook_secret</font> en texto plano. Si alguien accede a la BD '
        '(SQL injection, backup robado, insider), tiene las credenciales de MP completas.'
    ))
    story.append(body(
        '<b>Fix:</b> Crear <font face="Courier">src/lib/crypto.ts</font> con '
        '<font face="Courier">encrypt()</font>/<font face="Courier">decrypt()</font> usando '
        'AES-256-GCM y una key de <font face="Courier">ENCRYPTION_KEY</font> env var. Cifrar '
        'antes de upsert, descifrar al leer. El token quedaría: '
        '<font face="Courier">enc:abc123...</font> en la BD.'
    ))

    # 5
    story.append(small_title('5. Validar IP en webhook MP'))
    story.append(kicker('Prioridad crítica · Esfuerzo bajo'))
    story.append(body(
        '<b>Problema:</b> El webhook valida la firma HMAC, pero si un atacante descubre el '
        'webhook secret (que está en texto plano — ver punto 4), puede forjar webhooks desde '
        'cualquier IP.'
    ))
    story.append(body(
        '<b>Fix:</b> MP publica sus rangos de IP. Validar <font face="Courier">x-forwarded-for</font> '
        'contra esos rangos antes de procesar el webhook. Capa adicional de defensa si la firma '
        'se compromete.'
    ))

    story.append(PageBreak())

    # ── Fase 2: Importantes ──
    story.append(section_title('Fase 2 — Mejoras importantes'))
    story.append(body(
        'Estas 7 mejoras aportan defensa en profundidad y visibilidad. Se recomienda '
        'implementarlas en 2-3 días, después de la Fase 1.'
    ))

    # 6
    story.append(small_title('6. Sentry (monitoreo de errores)'))
    story.append(kicker('Prioridad importante · Esfuerzo bajo'))
    story.append(body(
        '<b>Problema:</b> No hay Sentry ni logs centralizados. Si hay un ataque, no te enterás '
        'hasta que un usuario reporta el problema.'
    ))
    story.append(body(
        '<b>Fix:</b> <font face="Courier">npm i @sentry/nextjs</font>, configurar '
        '<font face="Courier">sentry.client.config.ts</font> y '
        '<font face="Courier">sentry.server.config.ts</font>. Captura errores, performance '
        'issues, y violaciones CSP. Alertas a email/Slack.'
    ))

    # 7
    story.append(small_title('7. Error messages genéricos'))
    story.append(kicker('Prioridad importante · Esfuerzo bajo'))
    story.append(body(
        '<b>Problema:</b> Varios endpoints devuelven <font face="Courier">error.message</font> '
        'del catch directamente al cliente. Un atacante puede aprender sobre la estructura '
        'interna (nombres de tablas, queries).'
    ))
    story.append(body(
        '<b>Fix:</b> Crear helper <font face="Courier">handleApiError(error, operation)</font> '
        'que en dev loguea el error completo, en prod devuelve "Error interno" al cliente, '
        'y siempre loguea a Sentry con contexto.'
    ))

    # 8
    story.append(small_title('8. Quitar stack trace log'))
    story.append(kicker('Prioridad importante · Esfuerzo trivial'))
    story.append(body(
        '<b>Problema:</b> <font face="Courier">create-checkout/route.ts:67</font> hace '
        '<font face="Courier">JSON.stringify(error, Object.getOwnPropertyNames(error), 2)</font> '
        'que loggea el error completo incluyendo propiedades internas que pueden contener tokens.'
    ))
    story.append(body(
        '<b>Fix:</b> Reemplazar por <font face="Courier">console.error(\'[create-checkout] Error:\', '
        'err.message)</font> y dejar que Sentry capture el resto.'
    ))

    # 9
    story.append(small_title('9. Eliminar auto-migrate.ts'))
    story.append(kicker('Prioridad importante · Esfuerzo trivial'))
    story.append(body(
        '<b>Problema:</b> <font face="Courier">src/lib/auto-migrate.ts</font> usa '
        '<font face="Courier">$executeRawUnsafe</font> para ejecutar SQL arbitrario (DROP INDEX, '
        'ALTER TABLE). No se llama en runtime pero es código peligroso.'
    ))
    story.append(body(
        '<b>Fix:</b> Eliminar el archivo. Las migraciones deben hacerse con '
        '<font face="Courier">prisma migrate deploy</font>, no con SQL raw en runtime.'
    ))

    # 10
    story.append(small_title('10. Zod para validación de inputs'))
    story.append(kicker('Prioridad importante · Esfuerzo alto'))
    story.append(body(
        '<b>Problema:</b> Los endpoints validan inputs manualmente con <font face="Courier">if (!field)</font> '
        'sueltos. Propenso a errores — fácil olvidar validar un campo.'
    ))
    story.append(body(
        '<b>Fix:</b> <font face="Courier">npm i zod</font>, crear schemas declarativos, validar '
        'en cada endpoint con <font face="Courier">schema.parse(body)</font>. Type-safe, menos '
        'código, validación consistente.'
    ))

    # 11
    story.append(small_title('11. CSRF tokens en mutations'))
    story.append(kicker('Prioridad importante · Esfuerzo medio'))
    story.append(body(
        '<b>Problema:</b> Las API routes usan cookies de sesión. Si hay un XSS, el atacante '
        'puede hacer requests con la cookie del usuario. El CSP ayuda pero no es suficiente.'
    ))
    story.append(body(
        '<b>Fix:</b> Generar un token CSRF en el login, incluirlo en headers custom, validar '
        'server-side. NextAuth ya protege <font face="Courier">/api/auth/*</font>, pero las '
        'demás rutas necesitan protección adicional.'
    ))

    # 12
    story.append(small_title('12. Google OAuth config en producción'))
    story.append(kicker('Prioridad importante · Esfuerzo bajo'))
    story.append(body(
        '<b>Problema:</b> <font face="Courier">GOOGLE_CLIENT_ID</font> y '
        '<font face="Courier">GOOGLE_CLIENT_SECRET</font> no están en .env. El login con Google '
        'no funcionará en producción.'
    ))
    story.append(body(
        '<b>Fix:</b> Crear OAuth client en Google Cloud Console, agregar env vars a Vercel, '
        'configurar <font face="Courier">NEXTAUTH_URL</font> con el dominio de producción real.'
    ))

    story.append(PageBreak())

    # ── Fase 3: Hardening ──
    story.append(section_title('Fase 3 — Hardening y resiliencia'))
    story.append(body(
        'Estas 8 mejoras aportan defensa en profundidad, monitoreo y capacidad de recuperación. '
        'Se recomienda implementarlas en 3-5 días, pueden correr en paralelo con la Fase 2.'
    ))

    # 13
    story.append(small_title('13. Backup automático de BD'))
    story.append(kicker('Hardening · Esfuerzo medio'))
    story.append(body(
        '<b>Problema:</b> Neon tiene point-in-time recovery, pero no hay backup exportado a otro '
        'proveedor. Si alguien borra la BD de Neon, se pierde todo.'
    ))
    story.append(body(
        '<b>Fix:</b> Script <font face="Courier">scripts/backup-db.ts</font> que haga '
        '<font face="Courier">pg_dump</font> y suba a S3/Cloudflare R2 con cifrado. Cron job '
        'diario (Vercel Cron o GitHub Actions). Retención de 30 días.'
    ))

    # 14
    story.append(small_title('14. Health check endpoint'))
    story.append(kicker('Hardening · Esfuerzo bajo'))
    story.append(body(
        '<b>Problema:</b> No hay un endpoint <font face="Courier">/api/health</font> para '
        'integrar con uptime monitoring (UptimeRobot, BetterStack).'
    ))
    story.append(body(
        '<b>Fix:</b> Crear <font face="Courier">/api/health</font> (público) que checkee DB, '
        'MP config, y devuelva <font face="Courier">{status: \'ok\', checks: {db: true, mp: true}}</font>. '
        'Integrar con UptimeRobot (free) para alertas.'
    ))

    # 15
    story.append(small_title('15. IP + User Agent en auditoría'))
    story.append(kicker('Hardening · Esfuerzo bajo'))
    story.append(body(
        '<b>Problema:</b> Los registros de Auditoría guardan empleado y detalle, pero no la IP '
        'ni el user agent. Si hay un ataque, no se puede rastrear el origen.'
    ))
    story.append(body(
        '<b>Fix:</b> Agregar columnas <font face="Courier">ip</font> y '
        '<font face="Courier">userAgent</font> al schema Auditoria. Capturar en cada endpoint '
        'que crea auditoría.'
    ))

    # 16
    story.append(small_title('16. Dependabot (deps auto-update)'))
    story.append(kicker('Hardening · Esfuerzo trivial'))
    story.append(body(
        '<b>Problema:</b> No hay <font face="Courier">npm audit</font> automático ni Dependabot. '
        'Las vulnerabilidades conocidas pueden quedar sin parchear.'
    ))
    story.append(body(
        '<b>Fix:</b> Activar Dependabot en GitHub: crear '
        '<font face="Courier">.github/dependabot.yml</font>. Run npm audit en CI. Auto-merge de '
        'patches de seguridad.'
    ))

    # 17
    story.append(small_title('17. CSP report-uri'))
    story.append(kicker('Hardening · Esfuerzo bajo'))
    story.append(body(
        '<b>Problema:</b> El CSP actual bloquea violaciones pero no las reporta. No se detectan '
        'intentos de ataque XSS hasta que uno tiene éxito.'
    ))
    story.append(body(
        '<b>Fix:</b> Agregar <font face="Courier">report-uri /api/csp-report</font> al CSP. '
        'Crear endpoint que loguee a Sentry para análisis.'
    ))

    # 18
    story.append(small_title('18. Rotación de NEXTAUTH_SECRET'))
    story.append(kicker('Hardening · Esfuerzo trivial'))
    story.append(body(
        '<b>Problema:</b> Si el <font face="Courier">NEXTAUTH_SECRET</font> se filtra, todos '
        'los JWTs firmados con él son válidos hasta que expiren (30 días).'
    ))
    story.append(body(
        '<b>Fix:</b> Rotar el secret periódicamente (cada 90 días). Al rotar, todas las sesiones '
        'se invalidan automáticamente (los JWTs viejos no validan).'
    ))

    # 19
    story.append(small_title('19. 2FA para super-admin'))
    story.append(kicker('Hardening · Esfuerzo medio'))
    story.append(body(
        '<b>Problema:</b> El super-admin accede con solo email + contraseña. Si la contraseña '
        'se filtra, el atacante tiene control total de la plataforma.'
    ))
    story.append(body(
        '<b>Fix:</b> <font face="Courier">npm i otplib</font>. Al hacer login como super-admin, '
        'pedir código TOTP. El super-admin configura su 2FA una vez (QR con Google Authenticator). '
        'Obligatorio para super-admin, opcional para usuarios normales.'
    ))

    # 20
    story.append(small_title('20. Headers adicionales (COOP, COEP)'))
    story.append(kicker('Hardening · Esfuerzo trivial'))
    story.append(body(
        '<b>Problema:</b> Faltan headers de seguridad recomendados: '
        '<font face="Courier">Cross-Origin-Opener-Policy</font>, '
        '<font face="Courier">Cross-Origin-Embedder-Policy</font>, '
        '<font face="Courier">X-DNS-Prefetch-Control</font>.'
    ))
    story.append(body(
        '<b>Fix:</b> Agregar en <font face="Courier">next.config.ts</font> headers. Defensa en '
        'profundidad contra clickjacking avanzado y DNS prefetch leaks.'
    ))

    story.append(PageBreak())

    # ── Orden de implementación ──
    story.append(section_title('Orden de implementación recomendado'))

    story.append(subsection_title('Fase 1 — Críticas (1-2 días)'))
    story.append(bullets([
        '<b>#2</b> (Resend) — sin esto, register/forgot-password no funcionan en producción',
        '<b>#9</b> (eliminar auto-migrate) — 5 minutos, código peligroso',
        '<b>#8</b> (quitar stack trace) — 5 minutos',
        '<b>#1 + #3</b> (rate limit Redis + global) — protege contra fuerza bruta y DoS',
    ]))

    story.append(subsection_title('Fase 2 — Importantes (2-3 días)'))
    story.append(bullets([
        '<b>#4</b> (cifrar MP) + <b>#5</b> (IP webhook) — blindan el sistema de pagos',
        '<b>#6</b> (Sentry) + <b>#7</b> (error genéricos) — visibilidad de ataques',
        '<b>#12</b> (Google OAuth) — login con Google en producción',
    ]))

    story.append(subsection_title('Fase 3 — Hardening (3-5 días)'))
    story.append(bullets([
        '<b>#13</b> (backup) + <b>#14</b> (health check) — resiliencia',
        '<b>#16</b> (Dependabot) + <b>#17</b> (CSP report) + <b>#20</b> (headers) — automatización',
        '<b>#19</b> (2FA super-admin) — capa final',
        '<b>#10</b> (Zod) + <b>#11</b> (CSRF) + <b>#15</b> (IP auditoría) — defense in depth',
    ]))

    story.append(Spacer(1, 20))
    story.append(callout(
        '<b>Nota:</b> Todas las mejoras son compatibles con el código existente. Ninguna '
        'requiere migración de BD destructiva ni cambio de provider. Se pueden implementar '
        'de forma incremental sin downtime.'
    ))

    return story


# ═══════════════════════════════════════════════════════════
# BUILD
# ═══════════════════════════════════════════════════════════

def main():
    output_path = '/home/z/my-project/plan-mejoras-seguridad.pdf'

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=40,
        rightMargin=40,
        topMargin=50,
        bottomMargin=50,
        title='Plan de Mejoras de Seguridad — Hospedá',
        author='Hospedá',
        subject='Auditoría de seguridad y plan de mejoras',
        creator='Hospedá Security Audit',
    )

    story = build_story()

    # Usar onFirstPage para la portada, onLaterPages para header/footer
    doc.build(story, onFirstPage=cover_page, onLaterPages=header_footer)

    print(f'PDF generated: {output_path}')
    size = os.path.getsize(output_path)
    print(f'Size: {size/1024:.1f} KB')


if __name__ == '__main__':
    main()
