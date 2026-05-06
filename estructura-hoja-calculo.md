# Estructura sugerida para la hoja de calculo

Cuando conectemos este portal a una hoja de calculo, conviene separar la informacion en pestañas simples:

## Hoja 1: `Viajes`

Columnas sugeridas:

- `codigo_viaje`
- `numero_viaje`
- `tipo_viaje`
- `chofer`
- `usuario_chofer`
- `supervisor_asignador`
- `origen`
- `destino`
- `salida_esperada`
- `inicio_real`
- `fin_real`
- `estado`
- `kilometros_recorridos`
- `ultimo_ping`
- `observaciones`
- `fecha_creacion`
- `fecha_actualizacion`
- `cantidad_puntos`
- `url_ruta`

## Hoja 2: `Puntos_Ruta`

Columnas sugeridas:

- `codigo_viaje`
- `timestamp`
- `latitud`
- `longitud`
- `precision_metros`
- `velocidad_kmh`
- `secuencia`
- `kilometros_acumulados`

## Hoja 3: `Usuarios`

Columnas sugeridas:

- `usuario`
- `nombre_completo`
- `rol`
- `telefono`
- `activo`

## Hoja 4: `Bitacora`

Columnas sugeridas:

- `timestamp`
- `usuario`
- `accion`
- `codigo_viaje`
- `detalle`

## Recomendacion de enlace futuro

- `Supervisor` crea o edita viajes
- el portal escribe la fila principal en `Viajes`
- cada captura de ubicacion agrega una fila en `Puntos_Ruta`
- al finalizar el viaje se actualiza `fin_real`, `estado`, `kilometros_recorridos` y `url_ruta`
- `url_ruta` puede apuntar a `route.html?trip=CODIGO_DEL_VIAJE`

Asi despues se puede analizar el kilometraje, visualizar rutas y sacar reportes por chofer, origen, destino o fecha.
