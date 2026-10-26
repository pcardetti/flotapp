# Auditoría UX/UI · Tallerflota

Revisión de las tres apps (Tallerflota, Chofer y Taller) en modo demo, en computadora (1366 px) y celular (375 px),
más el código de los componentes compartidos. Fecha: 25/10/2026.

**Estado:** los puntos 1, 2, 10, 11 y el plural del punto 14 están resueltos en la rama `ux/arreglos-rapidos`.

## Lo que ya está bien

- **Sistema visual coherente.** Tokens de color en `globals.css`, un acento por app (azul, amarillo vial, cian) y
  verde, ámbar y rojo reservados para estados. Las patentes Mercosur y viejas dibujadas son un gran detalle de oficio.
- **Apps de celular pensadas para una mano.** Botones de 56 px, barra inferior, acción fija abajo, kilometraje
  grande con separador de miles, nivel de combustible visual.
- **Formularios que guían.** El chequeo de salida no deja el botón apagado: dice qué falta y lleva hasta ahí.
  Los errores reciben el foco y se leen con lector de pantalla.
- **Inicio del chofer claro.** Viaje en curso arriba, tres acciones grandes, documentos por vencer a la vista.
- **Pendientes del taller agrupados por unidad**, con gravedad, fotos y un botón por falla.

## Prioridad 1 · Seguridad y núcleo del producto

### 1. "Lo que falta, bien" aprueba también los puntos críticos

En el chequeo de salida, un toque marca como correctos todos los puntos sin responder, frenos y luces incluidos.
Es el atajo que convierte un control de seguridad en un trámite, y la flota queda con un registro que dice
"frenos bien" sin que nadie los haya mirado.

**Propuesta**
- El atajo marca sólo los puntos no críticos. Los críticos (ícono de escudo) se responden uno por uno.
- El texto del botón lo dice: "Lo demás, bien (los críticos uno por uno)".
- Si se quiere más control: registrar en el chequeo si se usó el atajo, para que el jefe de taller lo vea.

Archivo: `src/app/chofer/salida/[codigo]/chequeo.tsx`, función `todoBienLoQueFalta`.

### 2. El aviso de falla arranca con "Sí, puedo seguir" elegido

El estado inicial es `grave = 'no'`. Un chofer apurado manda la falla sin pensar la gravedad y el taller la recibe
como no urgente. El valor por defecto empuja la respuesta en la dirección más riesgosa.

**Propuesta**
- Sin selección inicial. Mientras no elija, el botón dice "Indicá si podés seguir" y lleva a la pregunta,
  igual que el chequeo de salida.
- Considerar una tercera opción "No sé", que llegue al taller como "a revisar" y pida una llamada.

Archivo: `src/app/chofer/formularios.tsx`, línea 110.

### 3. La ficha de la unidad no tiene historia

La página de venta promete "Cada camión con su historia, al día". La ficha de la unidad muestra datos, kilometraje
y el QR, pero no sus fallas, trabajos, órdenes, gastos, vencimientos ni costo por km. Para ver la historia de un
camión hay que cruzar a mano cuatro secciones.

**Propuesta: la ficha como centro de cada camión**
- **Encabezado:** patente, modelo, estado, chofer y kilometraje. Acciones: Editar, Reportar falla, Imprimir QR.
- **Requiere atención:** fallas abiertas, vencimientos de la unidad y próximo service.
- **Historial:** una sola línea de tiempo con fallas, trabajos, órdenes, viajes y lecturas de km, filtrable por tipo.
- **Costos:** total del período, costo por km y desglose (combustible, mantenimiento, neumáticos).
- **Datos y QR** abajo o en una pestaña aparte. Eliminar queda al final, como ya está.

### 4. El mantenimiento preventivo y los neumáticos no tienen pantallas

La base tiene `tareas_plan` (services por km o fecha) y `neumaticos` con historial, pero ninguna sección los
muestra. Para un sistema de mantenimiento, el preventivo es el núcleo: hoy la app registra lo que se rompe
pero no avisa lo que toca hacer.

Antes de diseñar conviene confirmar con la sesión Master si esto está planificado para más adelante.

**Propuesta mínima**
- Sección **Plan de mantenimiento**: tareas por tipo de unidad, cada cuántos km o días, lo primero que llegue.
- Estado por unidad: al día, próximo (ámbar) y vencido (rojo), con los km o días que faltan.
- En el tablero, sumar "Services vencidos" a la fila de atención.
- En la app Taller, una pestaña **Services** junto a Pendientes.
- Neumáticos: posición en un esquema del camión, vida, km y estado, con montar, rotar y recapar desde ahí.

## Prioridad 2 · Eficiencia y claridad

### 5. El tablero muestra primero los costos y después lo urgente

El orden actual es: seis indicadores de costo, después la fila de estado (fallas abiertas, unidades en servicio,
vencimientos) y los vencimientos vencidos al final de la página. Quien abre el tablero a la mañana necesita
primero saber qué está parado o vencido.

Además, "Fallas reportadas: 9" tiene borde rojo y es un conteo del período, mientras que "4 fallas abiertas" es lo
que pide acción. Dos números rojos con nombres parecidos se confunden.

**Propuesta**
- Primera fila: **Requiere atención** (fallas críticas abiertas, unidades paradas, documentos vencidos y services
  vencidos), cada una con enlace directo. Si no hay nada, una sola línea verde: "Todo en orden".
- Segunda fila: indicadores de costo, sin borde rojo. Las fallas del período pasan a ser un dato neutro.
- Rojo sólo para lo que pide acción hoy. Así el color sigue significando algo.

### 6. "Resolver" en la web lleva a la app de celular del taller

En Taller, dentro de la administración, el botón Resolver abre la pantalla de la app Taller. Se pierde el menú
lateral, la pantalla queda angosta en la computadora y volver depende del botón del navegador.

**Propuesta**
- Resolver en un panel lateral dentro de la administración, con el mismo formulario.
- Si se mantiene el salto, que la app Taller reciba de dónde viene y el botón Volver lleve a la administración.

### 7. Resolver una falla sólo permite cerrarla

El formulario termina siempre en "Guardar y resolver la falla". En el taller real es común que una falla quede
esperando un repuesto, se derive a un taller externo o no se pueda reparar en el momento.

**Propuesta:** debajo del botón principal, una opción secundaria "No la cerré todavía" con tres salidas:
- Espera repuesto.
- Derivar a taller externo.
- Abrir orden larga.

La falla queda "En reparación" con el motivo visible para la flota.

### 8. Las fotos se abren en otra pestaña

Las fotos de fallas, comprobantes y documentos abren la imagen suelta en una pestaña nueva. En la app instalada en
el celular eso saca al usuario al navegador, sin forma clara de volver.

**Propuesta:** un visor dentro de la app que ocupe la pantalla. Se pasa de foto con el dedo, se amplía con dos dedos
y se cierra con una X grande o deslizando hacia abajo. Un solo componente sirve para fallas, gastos y vencimientos.

### 9. La administración en el celular esconde casi todo el menú

En el celular, las 11 secciones quedan en una tira con desplazamiento lateral y sólo se ven 3. Nada indica que hay
más, y Taller, Vencimientos o Equipo quedan fuera de la vista.

**Propuesta:** usar la misma barra inferior que Chofer y Taller, con Tablero, Taller, Flota y "Más". "Más" abre una
hoja con el resto de las secciones y los accesos a las otras apps. Las tres apps se manejan igual.

### 10. Entrar al chequeo con un viaje en curso redirige sin explicar

Si el chofer escanea un QR teniendo un viaje abierto, vuelve al inicio sin ningún mensaje.

**Propuesta:** avisar "Ya tenés un viaje en curso con AF 123 KD. Terminalo para empezar otro", con el botón
Terminar viaje a mano.

## Prioridad 3 · Accesibilidad y pulido

### 11. El gris secundario no llega al contraste mínimo

Contraste de `--ink-3` (#66748a) contra los fondos, frente al mínimo de 4,5 para texto chico:

| Fondo | Contraste |
|---|---|
| `--bg` | 4,30 |
| `--surface-2` | 4,00 |
| `--surface` | 4,74 |

Se usa en etiquetas de sección de 12 px, ayudas y bajadas, justo lo que el chofer lee al sol.

**Propuesta:** cambiar `--ink-3` a `#56647a`. Queda en 5,45 sobre el fondo y 5,06 sobre `--surface-2`, y casi no
cambia el aspecto.

### 12. Objetivos táctiles chicos

| Elemento | Alto actual |
|---|---|
| "Elegir de la galería" | 20 px |
| "Lo que falta, bien" | menos de 44 px |
| Casillas de verificación | 18 px |
| "Editar" en la lista de choferes | menos de 44 px |

Con guantes o manos sucias, 44 px es el mínimo.

**Propuesta:** "Elegir de la galería" como segundo botón al lado de "Sacar foto", del mismo tamaño. Las casillas con
el área de toque en toda la fila.

### 13. Texto muy chico para usar en la calle

Las etiquetas de la barra inferior miden 11,5 px y hay 38 usos de `text-xs` (12 px). En las apps Chofer y Taller,
13 px como mínimo y 14 px para todo lo que se lee al pasar.

### 14. Detalles de texto

- "4 fallas abiertas (1 críticas)": falta el singular. Archivo `src/app/empresa/[org]/panel/tablero.tsx`, línea 138.
- El aviso de prueba gratis ocupa unos 80 px arriba de cada pantalla en el celular. Se puede mostrar completo en el
  tablero y reducido a una línea en el resto.

### 15. Componentes duplicados

- Hay dos `Vacio` con estilos distintos, en `encabezado.tsx` y en `movil.tsx`.
- `Boton` (38 px, texto chico) y `BotonEnviar` (56 px, texto grande) son dos escalas sin una regla escrita.

**Propuesta:** un solo `Vacio` con variante compacta, y `Boton` con tamaños `normal` y `grande`. Las apps de celular
usan siempre `grande`.

## Orden sugerido de trabajo

| Orden | Qué | Esfuerzo |
|---|---|---|
| 1 | Puntos 1, 2, 10, 11 y 14: cambios chicos con mucho impacto | Horas |
| 2 | Puntos 5, 8, 12 y 13: tablero, visor de fotos y tamaños | 1 a 2 días |
| 3 | Puntos 6, 7 y 9: flujos de resolver y navegación en el celular | 2 a 3 días |
| 4 | Punto 3: ficha de la unidad con historial y costos | 3 a 4 días |
| 5 | Punto 4: plan de mantenimiento y neumáticos, después de decidirlo con Master | 1 a 2 semanas |
