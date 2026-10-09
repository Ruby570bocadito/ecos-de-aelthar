# ECOS DE AELTHAR — HISTORIA Y AMPLIACIÓN

### La biblia oficial del mundo, de sus gentes y de lo que vendrá

> *«Cuando el miedo te hable, canta más alto.»*
> — Anciana Brisa, Guardiana del Canto

**Versión del documento:** 1.0 · Octubre de 2026
**Versión del juego:** 0.5.x (Actos I–IV completos, mundo vivo, modo desafío)
**Naturaleza:** Biblia narrativa y de diseño híbrida. La primera mitad cuenta la historia de Aelthar tal como existe hoy en el juego; la segunda mitad diseña su ampliación.
**Fuentes:** Todo el contenido citado está extraído del código real del juego (`data.ts`, `hooks.ts`, `engine.ts`, `interaccion.ts`, `worldlife.ts`, `timeskip.ts`, `challenge.ts`, `achievements.ts`, `armor.ts`, `balance.ts`, `skilltree.ts`, `maps.ts`, `maps_expansion.ts`, `enemies_expansion.ts`, `screens.ts`) y del `docs/ROADMAP.md` del repositorio. Las citas entre comillas son literales del juego.

---

## ÍNDICE

**PRIMERA PARTE · LA HISTORIA DE AELTHAR**

1. Cosmología: El Canto Primigenio
2. Las Edades de Aelthar (cronología maestra)
3. Geografía viva: los seis mapas y la Arena
4. Fichas de personajes (I): el Portador y sus cercanos
5. Fichas de personajes (II): aliados lejanos y enemigos
6. Acto I — «El Despertar»
7. Acto II — «Las Notas Perdidas»
8. Acto III — «El Canto al Revés»
9. Acto IV — «El Último Canto»
10. Las siete Memorias del Portador
11. Ecos menores, rumores y carteles: la voz del mundo
12. Los sistemas al servicio de la historia

**SEGUNDA PARTE · LA AMPLIACIÓN: EL SEGUNDO CANTO**

13. Visión general de la ampliación
14. Acto V — «El Segundo Canto»: la región del Norte
15. Nueva Partida+ (NG+): El Canto Recordado
16. Desafío 2.0: la Arena que crece
17. Gremios y facciones: los cuatro coros de Aelthar
18. Nuevas mecánicas: el hogar, las criaturas y el comercio
19. Plan de implementación y multijugador
20. Glosario de Aelthar
21. Apéndice: datos de diseño y notas de canon

---

## CÓMO LEER ESTA BIBLIA

Este documento está pensado para tres lectores distintos, y por eso alterna deliberadamente entre tres voces. El primer lector es el jugador que terminó la demo y quiere quedarse a vivir en el valle: para él están escritas la cosmología, la geografía y las fichas de personajes, donde se cuentan los porqués de cosas que el juego solo insinúa. El segundo lector es el futuro escritor o diseñador que va a ampliar el juego: para él están las fichas de sistemas, las notas de canon y la segunda parte entera, que no solo propone contenido sino que lo ancla en lo que ya existe para que nada suene impostado. Y el tercer lector es el propio equipo de desarrollo dentro de unos meses, cuando la memoria del porqué de cada decisión se haya borrado como un nombre bajo la Niebla: para él están los apéndices, los datos exactos y las citas literales.

Tres convenciones recorren el documento. Primera: cuando una frase aparece entre comillas y lleva atribución, es texto real del juego, copiado del código; cuando aparece en cursiva sin atribución, es voz narrativa de esta biblia que expande sin contradecir. Segunda: los nombres propios —personas, lugares, objetos, facciones— se escriben siempre tal como los escribe el juego, porque en Aelthar los nombres son literalmente sagrados: nombrar mal es una forma de borrar. Tercera: donde el código guarda un enigma deliberado (el nombre de Nimue, la «segunda vez» de la Lanza, el nombre verdadero de Merrow), esta biblia no lo cierra: lo marca como **ENIGMA ABIERTO** y deja constancia de qué pistas hay sembradas, para que la ampliación pueda cobrarse esa deuda sin romperla.

Una advertencia final, que es también una promesa: en Aelthar la memoria es el campo de batalla. Esta biblia existe para que ni un solo nombre se pierda dos veces.
# PRIMERA PARTE · LA HISTORIA DE AELTHAR

## 1. COSMOLOGÍA: EL CANTO PRIMIGENIO

### 1.1 La voz que sostenía el mundo

Hace mil años, el mundo no existía todavía del todo. Había montañas sin nombre y mares que no sabían adónde iban, y las noches eran tan largas que los primeros hombres creían que eran eternas. Entonces despertó **Aelthar, el dios-tejedor**, y comenzó a cantar. La introducción oficial del juego lo dice con la contención de las crónicas: *«Hace mil años, el dios-tejedor Aelthar sostenía el mundo con su canto. Cinco pueblos crecieron a su abrigo y las ciudades se alzaron con cada nota»*.

Conviene detenerse en ese verbo: **sostener**. Aelthar no fue un dios que modelara el mundo con las manos como un alfarero, ni uno que lo conquistara como un rey. Su canto era una cuerda tensada bajo el mundo, y en cada nota el mundo quedaba un poco más firme, un poco más él. Lo que el Canto nombraba, permanecía. Lo que el Canto tejía, no se deshacía. Los ríos aprendían su cauce de oído; los árboles aprendían a soltar las hojas a tiempo; los pueblos aprendían a llamarse unos a otros para no perderse. Todo lo que en Aelthar dura, empezó siendo una nota.

De ahí la primera gran ley del mundo, que el juego enseña sin proclamarla: **nombrar es sostener**. Los aldeanos de Merrow se llamaban los unos a los otros cada mañana, en voz alta, *«para no perderse»*. Los aldeanos de Lunaris susurraban sus nombres al pozo *«para que el dios los tejiera en su canto»*. Los pastores de las Cumbres cantaban por turnos *«para que el silencio no encontrara a nadie solo»*. No eran supersticiones: eran mantenimiento. El Canto necesitaba voces humanas como un tejido necesita ambas manos. El dios no cantaba solo; cantaba con.

Y de ahí, también, el horror específico de este mundo. Si nombrar es sostener, entonces **olvidar es matar**, y alguien que borre los nombres no deja cadáveres: deja ausencias. Eso hará después la Niebla Muda. Por eso en Aelthar ningún peligro asusta tanto como uno que trabaja silenciando.

### 1.2 Los cinco pueblos del alba

La crónica dice que «cinco pueblos crecieron a su abrigo». El código conserva dos vivos, dos huérfanos y un silencio. Este es el estado de la cuestión, tal como lo conoce un Portador al terminar el Acto IV:

- **Lunaris**, el valle. *«Cuna del Portador · Zona 1–8»*, dice su letrero. Pueblo de piedra cálido, con plaza, forja, pozo y santuario. Fue el pueblo que mejor aprendió a sobrevivir al silencio: callándose juntos. En el pasado celebraba el **Festival del Canto**, y sus campanas de festival fueron los últimos ornamentos que el metal de Toln tuvo antes de aprender cosas más tristes.
- **Merrow**, la aldea costera. *«La que la Niebla borró · Zona 12–16»*. Su nombre actual no es su nombre: *«Merrow no es su nombre. Es el que quedó cuando la Niebla borró el verdadero, como quien roba un pañuelo y deja la mano fría»*, dice su eco menor. En el pasado arde el **Festival del Nombre**, donde cada familia decía en voz alta el nombre de sus hijos al alba.
- **La Ciudadela**, sede de la **Orden de Vesh**. No aparece aún en el juego —la ampliación la espera—, pero su sombra cae sobre todo el mundo: desde ella gobierna la Orden que mató al dios, y hacia ella subieron *«todos los que oyeron el primer Eco. Ninguno volvió»*.
- **El pueblo del Bosque**, hoy sin nombre y sin casas: los que caminaban con la **Madre Espina** y hablaban con los árboles. De su estirpe queda Ilwen, y de su magia quedan las flechas que vuelven solas al aljaba. Lo que fue de ellos es un hilo que la ampliación debe cobrar.
- **El pueblo de las Cumbres**, los pastores del turnos de canto. No tuvieron aldea que la Niebla pudiera comer: tuvieron hogueras. Su legado es el lago que congela coros y un Gólem que los cuenta cada noche.

**ENIGMA ABIERTO (nombres perdidos):** los nombres originales de tres de los cinco pueblos. Pistas sembradas: Merrow *«no es su nombre»*; el pozo de Lunaris devuelve nombres; el lago de las Cumbres *«no congela agua: congela coros»*. La ampliación puede devolver cualquiera de esos nombres por la misma vía que usa el juego: los faroles, los pozos, los deshielos.

### 1.3 La resonancia: cómo funciona la magia de este mundo

Toda la magia de Aelthar es una sola cosa vista desde fuera y desde dentro. Desde fuera se llama **Canto**: la melodía del dios que sostiene el mundo. Desde dentro se llama **Resonancia**: la parte de ese Canto que vibra en cada cosa viva y que un portador puede avivar y dirigir. El juego la mide como un recurso (la barra de resonancia que ganan los golpes y las muertes enemigas, *«+6 por golpe y +10 por muerte»*) y la gasta en los Cantos del Tejedor —ascuas, escarcha, chispa— y en las habilidades del árbol.

Las reglas de la resonancia, tal como el juego las practica y esta biblia las formula:

1. **Todo lo que existe resuena.** Los metales (el yunque de Toln *«templó al revés»* cuando el Canto se torció), las piedras (las de la muralla de Lunaris *«cantan por el tercer capellán cuando llueve»*), el agua (el mar *«susurra con voz prestada»*), el hielo (congela coros enteros).
2. **La resonancia se hiere como una voz.** Un canto al revés no es una canción: *«es una puerta abierta del otro lado»*, dice Toln. Por eso los ecos invertidos del Acto III no son un juego musical: son heridas en la membrana del mundo.
3. **La resonancia se puede prestar, robar y devolver.** La Niebla *«aprendió»* el Canto nota a nota. La Guarda dejó su voz en la piedra. Velmora tiende su ayer *«como quien tiende una taza»*. El mal —y la cura— viajan siempre por préstamo.
4. **La debilidad elemental es afinidad invertida.** Cada criatura del juego tiene una debilidad (el Gólem teme al fuego, la Sirena al rayo, los muertos a lo sagrado), y el juego la trata como ×1,5 de daño. En términos de biblia: cada ser canta en una tonalidad, y la tonalidad contraria le entra cruda.

### 1.4 El ayer: la moneda metafísica

La revelación central del Acto III, dicha por Velmora a través de la boca de Brisa, redefine todo el mundo: *«Aelthar no murió por su PODER. Murió por su HAMBRE. Cada nota del Canto le costaba un ayer del mundo —un día entero de vidas ajenas, comido y digerido en melodía—»*.

Aquí está la física profunda de Aelthar, y conviene escribirla despacio porque toda la ampliación se apoya en ella:

- El Canto no era gratuito. Cada nota que el dios tejía en el mundo se pagaba con un **ayer**: un día ya vivido, arrancado de la memoria colectiva y digerido en melodía. El mundo pagaba su propia solidez con su propio pasado.
- Mientras el Canto sonaba, nadie notó la factura. Los días pasaban y los ayeres sobraban. Pero la hambruna del dios creció con el mundo: cuantas más notas necesitaba, más días comía.
- Cuando la Orden mató al dios, el Canto se quebró en **siete Ecos**. El mundo dejó de pagar ayeres... pero también dejó de recibir notas. La Niebla Muda es la cicatriz de esa amputación: lo que antes era un canto con hambre, ahora es un silencio con apetito.
- Y el detalle más cruel, sembrado en la Memoria VI y en el Acto III: **la primera nota del Canto se pagó con el ayer de Velmora**, la Primera Portadora. El dios empezó su obra comiéndose el día de alguien concreto. Todo el resto de la historia es la estela de esa primera factura.

De esta moneda nacen las reglas que el juego ya practica: la Niebla come *«el día de antes»* de Merrow (q12); los cambios de época son literalmente caminar sobre ayeres prestados que el mundo aún recuerda («*el suelo aún no sabe doler*»); y la Campana del Ayer del Acto IV funciona porque *«reparte las horas»* que el valle tenía guardadas. La ampliación tiene aquí su mina: un mundo donde el tiempo ya vivido es recurso, comida y moneda.

### 1.5 La Noche del Silencio: la Lanza y la Orden

Hace trescientos años ocurrió el crimen que da nombre a la era actual. La introducción lo cuenta en tres líneas: *«Hace 300 años, la Orden de Vesh asesinó al dios. Su canto se quebró en siete Ecos y sin él la Niebla Muda avanza, borrando pueblos, recuerdos y nombres»*.

La orden que lo ejecutó toma nombre de su fundador: el **Gran Inquisidor Vesh**, un hombre que *«vio qué pasaba cuando el Canto tenía hambre»* y que decidió que ningún dios hambriento podía seguir teniendo al mundo de despensa. Su instrumento fue la **Lanza de los Durn**: *«una lanza sin canto, sorda de nacimiento»*, forjada en la Cripta por los herreros Durn precisamente porque no resonaba. Solo una cosa sorda podía atravesar a un dios cuyo cuerpo era una canción. La Lanza atravesó el costado del dios —lo dice el Heraldo: *«la primera vez, la Lanza de los Durn atravesó el costado del dios y su canto se hizo mil pedazos que llamáis Ecos»*— y esa herida es la Noche del Silencio.

La biblia formula aquí lo que el juego deja entrever y la ampliación confirmará: la Orden no fue un culto maligno. Fue una cirugía. *«La Orden no asesinó a tu dios por poder — mató por MISERICORDIA»*, confiesa Velmora; y añade la frase que sostiene todo el edificio moral del juego: *«Dos verdades caben en una noche: fue un asesinato... y fue un regalo»*. El juego deja al jugador decidir qué verdad se cuenta —la decisión del Acto III ramifica reputaciones y epílogos—, pero la biblia fija el hecho desnudo: el mundo vive hoy gracias a un crimen, y el crimen, a su vez, es la única razón de que quede un mundo que salvar.

**ENIGMA ABIERTO (la segunda vez):** el eco menor de la Cripta dice que la Lanza Muda *«sigue silbando en algún rincón del mundo... esperando la segunda vez»*, y el Heraldo repite: *«la Lanza ya está preparada para la segunda vez»*. Nadie en el juego explica qué segunda vez. La ampliación del Acto V (capítulo 14) propone la respuesta canónica.

### 1.6 La Niebla Muda

La Niebla es el antagonista del mundo, y el juego tiene el cuidado de no hacerla ni malvada ni estúpida: la hace **aprendiz**. Empezó siendo el silencio que entró por la herida del dios —un vacío con hambre de lo que antes llenaba ese hueco—, y en trescientos años ha aprendido oficios: come nombres (*«la Niebla ha aprendido a comerse el día de antes»*, dice Mera), aprende melodías (*«la Niebla no está robando el Canto. Lo está APRENDIÉNDOLO. Nota a nota, al revés»*), aprende voces (*«algo canta al revés con voz de mujer»*, la nota de Velmora), aprende letra (*«enderézalos antes de que aprendan la letra»*, pide Toln) e incluso aprende modales: los presagios de la Ronda 7 la muestran probando el nombre del jugador *«como quien prueba una llave que no es suya»*.

Sus cuerpos, cuando toma cuerpo, son sus hambres especializadas: los **Lobos de Niebla** (*«fueron una vez perros guardianes de Lunaris. Aún patrullan. Ya no saben para qué»*), las **Sombras sin Rostro** (*«pedazo de Niebla con hambre. Devora nombres»*), los **Espectros sin Nombre** (vecinos de Merrow *«que olvidaron hasta su hambre»*), el **Eco Desgarrado** (*«un eco partido en dos que aún intenta cantarse a sí mismo»*), el **Sátiro de la Niebla** (*«músico cabrío que silba baladas curvas»*). Y sus criados mayores —el Guardián Hueco, la Sirena, el Coro Roto, el Heraldo— son todos, sin excepción, **cantantes rotos**: seres que tenían una voz y la perdieron, o la tuvieron y no cabía, o la entregaron por obediencia. La Niebla no crea: recluta luto.

### 1.7 Los siete Ecos y los Portadores

Cuando el Canto se quebró, se hizo siete pedazos: **los siete Ecos**. No son fragmentos de poder —así los llama el Heraldo despectivamente, *«las migajas de tu dios»*— sino fragmentos de melodía, y su recuperación es el esqueleto de toda la campaña. El juego en su versión actual deja recuperar tres mayores (la Voz, las Mareas, las Cumbres), un menor nacido del propio mundo (el Eco de los Nombres, de los faroles de Merrow) y deja constancia de que quedan *«seis Ecos»* por reunir al cerrar el Acto I. La cuenta del mundo —tres de siete recuperados más uno menor— es la que Brisa repasa en el cierre del Acto II: *«Dos voces más... tres Ecos de siete»*.

Los que pueden oír los Ecos se llaman **Portadores**. No son elegidos por mérito sino por resonancia: algo en ellos *«duerme»* —así lo dice Brisa del jugador: *«han olido el Eco que duerme en ti»*— y despierta al acercarse a un Eco. El oficio tiene una estadística fúnebre que el juego guarda en un eco menor del Bosque: *«Hubo otros antes que tú. Todos oyeron el primer Eco. Ninguno volvió de la Ciudadela. Prepara tu despedida, Portador»*. Y tiene una fundadora: **Velmora, la Primera Portadora**, cuyo ayer fue la primera nota, cuya voz es la que la Niebla canta al revés, y que ha esperado trescientos años tras los ojos de una anciana para poder por fin pasar el relevo.

**NOTA DE CANON (Aelthar / Velmora):** el juego usa dos nombres para el mundo. «Aelthar» es el nombre dominante —el del dios, dado al mundo por metonimia tras su canto— y así lo usa la portada, el mapa y todo el Acto IV. Pero un nodo del cierre del Acto II llama «Velmora» al mundo (*«Los otros N Ecos aguardan en Velmora...»*). Esta biblia canoniza la coexistencia: **el mundo se llamó Velmora en la era anterior al Canto, y la Primera Portadora llevó el nombre de su mundo** — nació con el nombre viejo, como quien lleva la placa de una casa que ya no existe. La ampliación puede usar esta identidad compartida como tema: cuando el Segundo Canto suene, el mundo elegirá un nombre para empezar de nuevo.

### 1.8 El tono del mundo: épico melancólico

Una palabra de diseño, para quien escriba el próximo capítulo de este mundo. Aelthar no es un mundo oscuro: es un mundo **entristecido**. Sus muertes suenan a campanas, no a gritos; sus monstruos lloran lo que fueron; su horror favorito no es el cuerpo sino el nombre vacío (*«la anciana busca su nombre entre los pliegues del chal y no lo encuentra»*). Y su esperanza funciona al revés de la de otros juegos: no llega con una espada legendaria sino con devoluciones — nombres devueltos, ayeres devueltos, horas repartidas. El juego lo dice en su final: *«el Canto de Aelthar no volvió porque un héroe lo buscara. Volvió porque alguien, paso a paso, fue devolviendo lo que le iban dando: una nana, una casa, un faro, un invierno, un canto al revés»*. Toda ampliación que quiera sonar a Ecos de Aelthar debe poder escribirse con ese verbo: devolver.
## 2. LAS EDADES DE AELTHAR (CRONOLOGÍA MAESTRA)

### 2.1 La Era del Canto (años −1000 a −300)

El milenio del canto no tuvo siglos que contar sino notas: los pueblos medían el tiempo por estrofas, por festivales, por campanadas. En su primer amanecer, el dios cantó la primera nota y pagó por ella el ayer de una mujer que se llamaba como el mundo: Velmora. En sus siglos fértiles se alzaron los cinco pueblos, se tallaron los pozos de los nombres, se plantaron los sauces llorones que después serían señales de casas recordadas, y los herreros Durn aprendieron su oficio en las profundidades de la Cripta —todavía sin saber para qué serviría su mejor obra.

En sus siglos maduros empezaron las grietas. La **Rebelión de los Sordos** fue la primera señal pública: *«los aldeanos se taparon los oídos con cera de abejas: "si el canto nos gobernaba, el silencio nos libera". Duraron un invierno... el silencio también se puede robar»*. El registro del eco menor deja ver que hubo razón para la rabia —un dios que gobierna por melodía gobierna también— y que el resultado fue un desastre: pasaron un invierno sin mantenimiento, y algo de lo que se comieron esos días nunca volvió. Nadie en el mundo actual recuerda ya qué se perdió exactamente; esa deuda anónima es, en el fondo, la primera cifra de la cuenta que la Niebla viene cobrando desde entonces.

Al final de la era, el hambre del dios se hizo difícil de ocultar. Los ayeres empezaron a faltar: se dice —la biblia lo fija como canon para la ampliación— que por esas fechas dejó de haber "mañanas dobles", ese fenómeno antiguamente común en que un día repetía su mejor hora y el mundo hacía dos veces la misma tarde. Los pastores de las Cumbres empezaron a cantar por turnos no por devoción sino por economía: si todos cantaban a la vez, el dios cobraba el día entero de golpe. *«La última noche cantaron todos a la vez. Nadie recuerda quién quedó para el alba»*.

### 2.2 La Noche del Silencio (año −300)

La fecha exacta no la guarda ningún calendario: la guardan tres objetos. La Lanza de los Durn, que la llevó en su punta. El faro de la costa, cuya lámpara se apagó esa noche y *«lleva trescientos años apagado»* con su familia encendiéndole *«una cerilla a la esperanza»* cada noche. Y la muralla de Lunaris, donde tres capellanes *«subían a cantar las horas»* y dos callaron para siempre, mientras el tercero seguía cantando —hasta que las piedras tuvieron que cantar por él—.

La secuencia del crimen, según la reconstrucción que hacen juntos el Acto III y el Acto IV: Vesh, Gran Inquisidor de la Ciudadela, ve el hambre del dios —quizá la ve mejor que nadie porque su función es ver: inquirir— y decide que la única misericordia posible es la amputación. Encarga a los Durn la Lanza sorda. Reúne a su Orden. Y una noche —la Niebla no existía aún; la noche era solo noche— sube hasta la Sala del Primer Canto, donde el dios había aprendido a cantar, y atraviesa con la Lanza el costado del dios. El Canto se hace *«mil pedazos que llamáis Ecos»*; siete de ellos son los mayores, los que el mundo seguirá buscando tres siglos. La última nota del dios queda en la Sala; el Gran Inquisidor deja allí escrita su orden póstuma: *«si alguien reúne el Canto, baja y sé su última nota»*.

Lo que la Orden no previó es que el silencio también tenía hambre. La **Niebla Muda** no fue creada: fue revelada —la brecha que el Canto tapaba— y comenzó a comer lo que antes comía el dios: nombres, días, pueblos. Merrow perdió su nombre y sus faroles esperaron en el ayer. El Bosque puso Niebla Muda de bloqueo entre él y el norte. Las Cumbres guardaron sus voces bajo el hielo porque *«el frío las guardó mejor que ellos»*. Y la Orden, que había salvado al mundo matando a su dios, se atrincheró en la Ciudadela a guardar su secreto y sus lanzas, con la conciencia partida en las dos verdades que caben en una noche.

### 2.3 La Era de las Cenizas (años −300 a 0)

Los trescientos años que separan el crimen del despertar del Portador son la era del aguante. No hubo guerras ni edades de oro: hubo faroles esperando, cerillas contadas, herreros forjando de noche *«aunque nadie compra»* porque *«el metal recuerda el ritmo del martillo»*, capellanes cantando horas que nadie marcaba, fareras encendiendo una cerilla por noche sobre un faro muerto, y una Niebla que avanzaba lenta, probando su nueva técnica: aprender en lugar de comer, para poder imitar mejor.

En esa era se apagó todo lo que el Acto II y el III encienden de nuevo. El lago de las Cumbres congeló los coros de los pastores que no quedaron para el alba. La Madre Espina perdió a su gente y le rompieron el corazón —*«no es mala: solo tiene roto el corazón»*—. Los lobos de Lunaris olvidaron a quién guardaban. Los barcos dejaron de buscar fuego en la costa y empezaron a buscar *«permiso para volver»*. Los Portadores que oían el primer Eco subían a la Ciudadela y no volvían. Y en la plaza de Merrow, una anciana esperaba trescientos años sin saber que esperaba, porque hasta la espera necesita un nombre.

También en esa era, el silencio hizo dos reclutas que la campaña tendrá que deshacer: la Sirena del naufragio —*«la que olvidó su nombre»*, que aprendió a cantar *«escuchando a mis vecinas nombrar a sus hijos al alba»* y cuya voz quedó *«suelta, como un farol sin gancho»*— y el Heraldo de Vesh, un hombre de la Orden que entró vivo a la Sala a cumplir la orden póstuma de su Gran Inquisidor y descubrió que ser la última nota era *«un CASTIGO... la última nota se queda vibrando para siempre, sin poder bajar del aire, oyendo apagarse el resto del canto nota a nota... hasta sonar sola, para nadie»*.

### 2.4 El Despertar (año 0, el presente del juego)

El presente empieza con un cuerpo junto a un santuario: *«tres noches algo cantó bajo tus sueños»*. Un Portador despierta en Lunaris sin pasado —el mundo, eso sí, le deja pistas: una nana, una casa junto al río, una madre sin rostro— y con la resonancia despierta. En pocos meses (el tiempo jugable de los cuatro actos) sucede lo que la era entera no consiguió: el primer Eco vuelve a sonar tras trescientos años, el faro se enciende, una aldea recupera tres faroles y un nombre, las cumbres recuerdan su canto, los ecos torcidos se enderezan, una campana nueva aprende a sonar, la Sala del Primer Canto se abre, y la última nota del Canto —que llevaba tres siglos vibrando para nadie— por fin descansa.

La cronología canónica, en una tabla:

| Año | Hito | Fuente en el juego |
|---|---|---|
| ≈ −1000 | Despertar de Aelthar; la primera nota se paga con el ayer de Velmora | Memoria VI, Acto III |
| ≈ −1000 a −900 | Los cinco pueblos crecen; pozos de nombres, festivales, campanas | Intro, ecos menores |
| ≈ −700 | Forja de la Lanza de los Durn en la Cripta | Eco menor «La Lanza Muda» |
| ≈ −600 a −400 | Rebelión de los Sordos (dura un invierno); empiezan a faltar ayeres | Eco menor del Bosque |
| −300 | **La Noche del Silencio**: la Orden mata al dios; el Canto se quebra en siete Ecos; nace la Niebla Muda | Intro slide 2; Acto IV |
| −300 | El faro de la costa se apaga; los capellanes de la muralla callan (dos de tres) | Mara, eco «Los Guardianes que aún cantan» |
| −300 a −250 | Merrow pierde su nombre; los faroles del Recuerdo esperan en el ayer | Eco menor «El nombre que nadie dice» |
| ≈ −250 | El Heraldo entra a la Sala y se convierte en la Última Nota | Acto IV, `acto4_heraldo_aviso` |
| ≈ −300 a 0 | La Niebla aprende el Canto al revés, nota a nota; sube a las Cumbres; congela los coros del lago | Acto III; eco «Las voces bajo el hielo» |
| 0 | **El Despertar**: el Portador abre los ojos en Lunaris | Intro slide 3, `brisa_intro` |
| +días | q1–q5: primer Eco, Guardián Hueco, Eco de la Voz (**Acto I**) | Campaña |
| +semanas | q6–q10: faro encendido, Sirena, Nera, Gólem (**Acto II**) | Campaña |
| +meses | q11–q13: ecos enderezados, revelación de Velmora, Guardián recordado (**Acto III**) | Campaña |
| +meses | q14–q16: Campana del Ayer, Sala del Primer Canto, Último Canto (**Acto IV**) | Campaña |

### 2.5 El tiempo que el juego hace sentir

Una nota final de diseño sobre el tiempo. Aelthar juega con tres escalas y las vuelve sentibles de formas distintas: el tiempo grande (mil años, trescientos años) se cuenta con objetos que envejecieron mal —un faro, una lanza, una cadena de eslabones que son *«un invierno cada uno»*—; el tiempo medio (la vida de los personajes) se cuenta con oficios interrumpidos —un herrero que forja para nadie, una farera que gasta cerillas—; y el tiempo pequeño (el del jugador) se cuenta en minutos reales: el ciclo día/noche dura 240 segundos, y el cambio de época con Q convierte el tiempo en un lugar por el que se camina. Cuando la ampliación añada nuevas eras, debe elegir qué objetos concretos las medirán: en Aelthar el tiempo no se narra, se toca.
## 3. GEOGRAFÍA VIVA: LOS SEIS MAPAS Y LA ARENA

Aelthar actual se juega en seis mapas de campaña y una arena fuera del tiempo. Cada uno tiene epígrafe oficial, historia propia y una forma de sonar. Este capítulo es la ficha de cada uno: primero lo que el juego garantiza (posiciones, conexiones, contenido), después lo que el mundo susurra sobre ellos. Los tamaños y posiciones provienen de las definiciones reales de `maps.ts` y `maps_expansion.ts`.

### 3.1 Valle de Lunaris — «Cuna del Portador · Zona 1–8» (52×38)

El valle es la casa y la lección. Todo lo que el jugador necesita entender del mundo está en un paseo: la plaza donde Brisa reparte esperanza y misiones, la forja donde Toln guarda su culpa de nieto (*«Mi abuelo forjó el arma que mató al dios... cada martillazo mío es una disculpa»*), el pozo de los nombres que devuelve silencio, las dos lápidas sin nombre que en el ayer eran flores, el cobertizo que en el presente es ruina y en el pasado tenía techos. Conexiones: el Bosque al norte (abertura entre murallas, x23–28), la Costa al sur (x25–27, se abre en el Acto II).

Su historia es la del pueblo que decidió sobrevivir callando. En el pasado, Lunaris celebra el **Festival del Canto**: hay flores donde después habrá lápidas, hay camino empedrado donde después hay tierra, hay un pueblo que tararea. En el presente queda la disciplina del silencio: vecinos que hablan bajo, un niño (Teo) que tararea para no tener miedo, y una anciana que lleva trescientos años de guardia verbal —Brisa canta para que el valle no olvide cómo se hace.

Secretos y contenido: cuatro cofres (uno solo abre en el pasado), tres ecos menores (el pozo de los nombres, la nieta del herrero, los Guardianes que aún cantan), cuatro Lobos de Niebla en el sur (el tutorial de caza de q2), el Santuario del Eco (25,18), y un detalle que la biblia ama: las briznas de luz al atardecer y las luciérnagas nocturnas son parte de la fauna oficial del valle.

### 3.2 Bosque Susurrante — «Los árboles recuerdan · Zona 8–15» (56×44)

El Bosque es el primer mapa que exige usar el pasado: su río (y10–12) corta el camino a la Cripta con un puente roto ('x') que solo es entero ('B') en el ayer. Es también el mapa de la Niebla: un bloqueo de tiles 'n' entre él y el norte que *«se disipa»* en el pasado, y árboles con *«silueta de terror»* (10% de los coposos: tronco en S y una cara sugerida de dos nudos como ojos — el juego tiene terror brujo, no gore).

Aquí viven las primeras piezas del corazón del juego. La **Ruina Antigua** (41,24) con sus pilares y su **Fragmento de Eco**, donde la voz del dios pregunta *«¿quiéeeeen... despierta... el canto...?»* y regala el cambio de época. Ilwen, la arquera que busca a su hermana, acecha en (16,32) esperando que el valle confíe en el jugador (aparece tras q2). Doran, el druida del **Círculo Verde**, defiende en (36,24) una teología incómoda: *«El Círculo Verde no la combate: la escucha... es lo que había ANTES del canto»* — para su orden, la Niebla no es enemiga sino un luto mal entendido.

Sus ecos menores son historia comprimida: la Madre Espina (*«no es mala: solo tiene roto el corazón»*), los lobos que fueron perros guardianes, la Rebelión de los Sordos, y el aviso más oscuro del mundo: *«El primer Portador... Ninguno volvió de la Ciudadela»*. Y guarda el easter egg más delicado: un cartel visible solo en el pasado, entre guirnaldas de flores, que susurra *«...nimue... nimue...»* y remata: *«Alguien duerme aquí debajo, y la Niebla la cuida como a una semilla. (Ilwen busca a su hermana... pero jura que no se llamaba así.)»* — el **ENIGMA ABIERTO de Nimue**, semilla de la ampliación.

### 3.3 Cripta del Primer Canto — «Fuera del tiempo» (40×34, oscura)

La Cripta es el único mapa que el cambio de época no toca: *«La Cripta existe fuera del tiempo»*. Es el vientre del mundo: aquí durmió la voz del dios, aquí forjaron los Durn la Lanza sorda, aquí está la Sala del Primer Canto donde todo empezó y donde todo se decide. Se juega a oscuras con una luz propia de 70 píxeles de radio, antorchas de rejilla determinista, ojos que brillan en la negrura (esqueletos y sombras) y una viñeta en forma de ojo que hace del jugador el pupilo del mapa.

Estructura: sala del altar al norte (el altar del Eco de la Voz en 19,4), pasillo central, arena del jefe (10,12, 20×10), nicho con santuario, dos salas laterales, pilares. Es escenario recurrente de toda la saga militar del juego: el Guardián Hueco (Acto I), el Guardián recordado (Acto III), El Coro Roto (opcional) y El Heraldo en la Sala (Acto IV). Sus ecos menores son los más duros: *«El Guardián Hueco fue el primer coro de Aelthar... hasta que su propia voz lo vació por dentro»*, *«La Lanza Muda... sigue silbando en algún rincón del mundo... esperando la segunda vez»* y el peregrino que dejó su lámpara encendida: *«Aún arde»*.

Sus rumores lo resumen: *«Bajar es fácil. Subir canta»*; *«El polvo aquí no se posa: espera»*. La Cripta es el pasado del mundo hecho lugar: por eso no tiene ayer —lo es.

### 3.4 Costa de Bruma — «Donde el mar guarda las notas · Zona 10–16» (52×40)

El mar es el archivo del mundo —*«El mar fue el primer archivo de Aelthar: cada ola leía un nombre en voz baja... La noche del asesinato, la marea subió más que nunca y, desde entonces, borra en vez de leer»*— y la Costa es su sala de lectura. Acantilado al norte, mar al sur y al este, orilla de arena, y tres heridas fijas: el **faro de Mara** (6,18), apagado trescientos años; el **naufragio** (41,22), donde duerme la Sirena (*«El naufragio cruje. Algo canta debajo, salado y vivo»*); y el **muelle viejo de Merrow**, en pie solo cuando el ayer lo sostiene (*«el ayer sostiene los tablones»*).

Aquí ocurre el mejor día del Acto II: Mara, la farera que lleva *«trescientas noches encendiéndole una cerilla a la esperanza»*, ve morir a la Sirena, enciende por fin el faro y pronuncia la frase que sostiene el optimismo del juego entero: *«Trescientos años, y esta mañana el mar se ha quedado sin hambre. Ven: ayúdame con la lámpara. La cerilla tiembla, pero la mano no»*. El juego la recompensa con el detalle más bonito de su libro de estilo: el faro encendido cambia la interacción del mundo entero —*«El faro de Mara arde de nuevo: la costa tiene permiso para volver»*.

Habitantes: neumos de marea (tiradores esquivos que *«escupen agua a distancia»*), espectros sin nombre en el presente, y el pez determinista que salta en arcos con su salpicadura —*«Los peces saltan donde no hay que pescar. El mar tiene humor»*—. De Vult, su cartógrafo, se cuenta en el capítulo 5.

### 3.5 Aldea de Merrow — «La que la Niebla borró · Zona 12–16» (44×34)

Merrow es el mapa-metáfora del juego entero: un pueblo al que no le mataron la gente, le mataron el nombre. Plaza central con pozo seco, cuatro casas en ruinas (enteras en el ayer), laguna con muelle al sureste, muralla rota, tres **Faroles del Recuerdo** (13,13 / 28,14 / 20,22) que *«no se encienden con fuego. Se encienden con nombres, y solo en el ayer»*. En el pasado arde el **Festival del Nombre**: guirnaldas, pétalos, puertas con farolillos encendidos, el pueblo cantándose a sí mismo.

Su gente son los espectros sin nombre —vecinos del presente a los que el juego recomienda saludar: *«Salúdalos; no muerde quien fue cortés»*— y Mera, la Espectro mayor que busca su nombre *«entre los pliegues del chal»* y lo recupera cuando el jugador le lleva el Eco de los Nombres: *«...Nera. Me llamaba Nera, y mi hijo la decía "madre Nera" como otros dicen "mañana clara"... es MÍO. Lo tengo»*. Es la escena que define el tono de todo el proyecto: la victoria en Aelthar no se mide en oro sino en nombres recuperados.

En el Acto III, Merrow sufre el golpe más fino de la Niebla: amanece *«sin ayer»* (q12), con sus vecinos vivos de pies a cabeza pero vacíos de memoria (*«No muerta: VACÍA»*). El jugador les devuelve tres recuerdos y aprende la regla de oro del mundo: *«sin ayer no hay mañana que esperar»*.

### 3.6 Cumbres Heladas — «El frío que aprendió a escuchar · Zona 14–20» (50×42)

Las Cumbres son el mapa del invierno como instrumento de memoria. Cordillera al norte con la meseta del altar (24,3), lago helado (30,30) sobre hielo resbaladizo de inercia real, hoguera apagada de los pastores (8,33), pinos nevados y el refugio de Ivo (27,37), el cazador gruñón que avisa con humor norteño: *«¡Alto ahí! ...aquí arriba los modales escasean y el pan está duro»*.

Su historia es la más dura de contarse en voz alta: *«Hubo un invierno en que la Niebla subió a las cumbres a buscar las últimas voces libres... el frío las guardó mejor que ellos»*. El lago no congela agua: *«congela coros... En los deshielos breves piden ayuda... en armonía»*, y el Gólem de Escarcha los cuenta cada noche *«como un pastor cuenta ovejas»*. Ivo lo dice sin adornos: *«Es hielo con memoria... No duerme, Portador: escucha. Lleva trescientos años contando los pasos de todo el que subió y no bajó»*. El Gólem lleva *«una cadena helada cruzada al pecho: cada eslabón es un invierno que la montaña no quiso decir en voz alta»*.

De noche, tras el Acto III, las Cumbres esconden al segundo jefe opcional: Vult, el Cazador de Ecos (*«Las cumbres susurran: hay un cazador en la noche»*). Y su rumor más hermoso es geografía pura: *«Las estrellas aquí bajan a beber al lago. Por eso faltan en los mapas»*.

### 3.7 Arena del Eco — «Modo Desafío · sobrevive o cae» (44×34)

Fuera del mapa y fuera del tiempo (epochDiffs vacío), la Arena es un anillo de piedra con cuatro clusters de pilares, rocas de cobertura y una sola puerta sur de emergencia. Su cartel fija su ética: *«Los caídos no juzgan: cuentan. La puerta del sur devuelve al valle con lo que trajiste»*. No tiene NPCs, cofres ni ecos: es el único lugar del mundo donde el Canto no se oye, y por eso funciona como gimnasio — allí los duelos se miden en tiempos y las oleadas en números, sin pagar ayeres.

La biblia la anota como frontera geográfica de la ampliación: la Arena es el embrión de un espacio social (capítulo 19, coop) precisamente porque está fuera de la narrativa y no puede romperla.

### 3.8 Los caminos entre mapas

La red de caminos es simple y con narrativa: Lunaris ↔ Bosque ↔ Cripta (solo cruzable en el ayer, primero) y Bosque ↔ Cumbres; Lunaris ↔ Costa ↔ Merrow. Los santuarios permiten viaje rápido entre mapas visitados (*«Viajar: {nombre del mapa}»*), y las herramientas de travesía del árbol (Campana del Retorno, Brújula de Ecos) tejen la red. El juego cierra el mapa por puertas narrativas, no físicas: la Niebla bloquea el norte del Bosque hasta tener sentido del tiempo; la Costa se abre con el Acto II; la Sala del Primer Canto solo abre con la Campana del Ayer y la palabra de la Guarda (*«Dile que Brisa aún canta»*). En Aelthar, una puerta se abre cuando la historia la respalda: así de simple y así de difícil.
## 4. FICHAS DE PERSONAJES (I): EL PORTADOR Y SUS CERCANOS

*Formato de todas las fichas: quién es · qué quiere · su arco · cómo suena (diálogo clave, literal). El jugador puede conocer más o menos de cada ficha según su partida; la biblia documenta el retrato completo.*

---

### 4.1 EL PORTADOR / LA PORTADORA (el jugador)

**Quién es.** Despierta junto al Santuario de Lunaris con el nombre que le dé el jugador —por defecto, «Portador»— y sin ningún recuerdo anterior. No tiene clase cerrada: elige una **disciplina inicial** entre la *Espada del Alba* (cuerpo a cuerpo, espada y escudo, 110 de vida) y el *Tejedor de Ecos* (báculo de resonancia, magia elemental, 96 de vida), con la promesa explícita del creador de personaje: *«Sin clase cerrada: en la demo eliges una disciplina inicial. En el juego final podrás mezclar dos y cambiarlas en los Santuarios»*. Empieza con 20 coronas, dos pociones y los cinco atributos a 2.

**Qué es en realidad.** Un ser con el Eco que *«duerme»* en él: alguien cuya resonancia interna despierta al acercarse a los fragmentos del Canto. Su origen íntimo está contado por negativos, a través de las siete Memorias: una nana junto a un río que tararea sin saber de dónde la sabe; una casa de piedra bajo un sauce con *«dos tazas en el umbral: una siempre llena, humeando»*; una madre sin rostro que le cose *«una marca de onda»* en la pañoleta y le dice *«acuérdate de lo que has hecho»*. La biblia fija la lectura canónica: el Portador creció en Lunaris antes de la Niebla —la casa del Memoria II *«estaba en Lunaris. Antes»*— y su madre tenía relación con el círculo de Velmora (la marca de onda es la insignia de los que cantan). **ENIGMA ABIERTO (la madre sin rostro):** ni ella puede ver la cara del jugador, ni el jugador la suya. La ampliación del Acto V puede cobrar este misterio.

**Qué quiere.** En la superficie, reunir los Ecos y frenar la Niebla. En profundidad —y el juego lo dice con la palabra exacta en el epílogo—, **devolver**: el Portador no colecciona poder, restituye lo robado. Su verdadero arco es convertirse en *«el Eco que elegiste»*: no el que era, sino el que fue haciendo caminando.

**Su personalidad la escribe el jugador, y el mundo la lee.** El sistema de tono (empático / pragmático / sarcástico / amenazante) suma cada elección de diálogo y, con tres respuestas de un mismo tono, el mundo lo confirma: *«Tu forma de hablar empieza a definirte: …»*. Los NPC tienen variantes de diálogo por tono —Toln llama «Listillo» al sarcástico; la Brisa del jugador amenazante le advierte de la Orden en lugar de serenarle—. Y su decisión moral mayor (contar la verdad de la Orden en el Acto III, o callarla) divide su epílogo en dos copas distintas.

**Cómo suena.** El juego le habla en segunda persona y con ternura: *«El pasado canta a tu alrededor»*, *«Despiertas junto al Santuario. Un eco de tu oro sigue donde caíste...»*. Su frase-manifiesto, dicha por su propia boca en la Memoria VII: *«El Canto nunca fue mío: fue de todos los que lo cantaron. Yo solo devolví lo que me tocó devolver»*.

---

### 4.2 ILWEN — la compañera, arquera del Bosque

**Quién es.** Arquera solitaria del pueblo perdido del Bosque, sprite de cazadora y arco, 60 de vida y una afinidad que se gana. Espera en el Bosque Susurrante (16,32) desde que el jugador demuestra en q2 que sabe proteger el valle (solo se muestra tras completarlo). Busca a su hermana **Naia**, raptada hacia el norte por la Niebla: *«Naia cantaba mejor que las nereidas»*.

**Qué quiere.** En voz alta, encontrar a Naia. En el fondo —y su rumor lo delata—, que alguien la acompañe mientras no la encuentra: *«si oyes mi silbo a tu izquierda cuando yo esté a tu derecha, no le sigas»*. Su reclutamiento es una lección de tono: si el jugador le ofrece compañía (*«Ven conmigo. Nadie debería tener que buscar sola»*), se une (*«Ilwen se une al grupo: cubre tu espalda con su arco»*); si le habla con crueldad (*«¿Y si lo que quedó de tu hermana ya no responde a tu silbo?»*), responde con el temple de su gente: *«Cuida esa lengua, Portador... Cuando hables como alguien con quien caminar, aquí estaré»*.

**Su arco.** De cazadora que no confía a lanza de la retaguardia que ya no teme. El juego lo mecaniza con cariño: afinidad que crece con el tono correcto (*«Ilwen te mira de otra manera... te está entendiendo (+1 afinidad)»*), avisos tácticos (*«¡Están flanqueándote!»*), y la cobertura en la muerte del jugador (*«Ilwen te cubre la retirada...»*). Su hilo personal queda abierto a propósito: **ENIGMA ABIERTO (Naia / Nimue)** — el cartel secreto del Bosque susurra «nimue» y afirma que la durmiente bajo las flores *no* es la hermana que Ilwen busca, o al menos no se llamaba así. La ampliación (cap. 14) propone la resolución.

**Cómo combate (ficha táctica).** Flecha de cobertura cada 2,4 s (daño `6 + nivel×1.2`) al enemigo con aggro más cercano, priorizando los **marcados**. Ciclo elemental de flechas fuego → hielo → rayo. Órdenes con la tecla T: **SEGUIR** (*«escolta clásica, cubre tu espalda»*), **AGRESIVO** (caza al enemigo con aggro más cercano, se retira bajo el 30% de vida), **DEFENSIVO** (guardia a 2 tiles e interposición: absorbe el 50% del daño melé a menos de 1,5 tiles, con recarga de 6 s — el mundo ve: *«−X ¡INTERPUESTA!»*). Regenera 8 HP/s fuera de combate, *«el vínculo la mantiene entera»*.

**Cómo suena.** *«Yo busco a mi hermana Naia»* / *«Nimue... no, nada. Sigue el camino y cubre mi espalda»* / *«Las flechas de Ilwen vuelven solas al aljaba. O eso jura ella»* (rumor ajeno).

---

### 4.3 ANCIANA BRISA — la Guardiana del Canto

**Quién es.** La mentora, la distribuidora de misiones y la voz moral del juego; vive en su casa de Lunaris (7,9) y su plaza es el latido del valle. Guardiana del Canto de profesión y de trescientos años de familia: su orden conserva la técnica de cantar para no olvidar.

**Qué quiere.** Que el valle siga teniendo mañana. Que el Eco vuelva. Y —esto es su secreto interno, revelado en el Acto III— hacer de puerta: cuando Velmora necesita hablar, es Brisa quien presta su boca (*«Velmora te observa. Lleva tres noches de pie detrás de tus ojos... Habla. Yo haré de puerta»*). Su apellido narrativo es el cansancio alegre: lleva toda una era sosteniendo el ánimo de un pueblo que ya no sabe por qué canta.

**Su arco.** De mentora a testigo. Acto I enseña; Acto II manda al mar; Acto III le hacen oír en su propia boca la verdad que su orden guardó trescientos años —y según lo que el jugador decida, la sabe o no la sabe—; Acto IV la cierra dirigiendo el Último Canto y quedándose en el valle con *«una taza llena y trescientas historias nuevas»*. Es el personaje que mejor encarna el tema de la memoria: quien recuerda en voz alta para todos.

**Cómo suena.** Su fórmula de saludo (*«Despierta, Portador... Se llama Aelthar... y lleva trescientos años esperando que alguien la oiga»*), su humor de guardiana (*«aquí los funerales ya no saben qué nombre decir»*), su cariño con severidad (*«vuelve con vida, Portador»*) y su cita-manifiesto: *«Cuando el miedo te hable, canta más alto»*.

---

### 4.4 MAESTRO TOLN — el herrero del metal que recuerda

**Quién es.** Herrero de Lunaris (forja en 32,9/37,10), nieto del herrero que forjó —con los Durn— el arma del crimen. Comercia lo esencial (pociones a 15 coronas, señuelos a 60, mejoras de arma +1 a +5, cinco corazas) y guarda lo inconfesable: la herencia de la Lanza.

**Qué quiere.** Redimir el oficio. Su frase de vida: *«Mi abuelo forjó el arma que mató al dios... cada martillazo mío es una disculpa»*. Por eso forja de noche aunque nadie compre: *«el metal recuerda el ritmo del martillo... y que algún día el canto volverá a necesitarlo»*. La sabiduría de su gremio cabe en su proverbio: *«Una espada sin canto corta. Con canto, convence»*.

**Su arco.** Es el personaje que más cambia de oficio sin cambiar de alma: de herrero a criador. Su momento culminante es q14, cuando descubre que el metal de su forja *«quiere ser CAMPANA»*: *«Lleva trescientos años esperando... Anoche, cuando el coro del valle cantó tus tres notas, el metal LLORÓ en la fragua. Una campana no se hace, Portador: se cría»*. El nieto del arma del crimen termina criando la campana que abre la Sala del Primer Canto: la redención del linaje hecha objeto —**La Campana del Ayer**.

**Cómo suena.** Con técnica y ternura a partes iguales: *«Ojo: los jefes no se distraen con panzadas»* (sobre el señuelo), *«+5 es lo que da de sí esta forja, Portador»* (en el límite de mejora), *«el yunque templó al revés: el filo salió ROMO»* (el Acto III desde el taller). Al sarcástico lo llama «Listillo» y le cobra igual.

---

### 4.5 TEO — el niño que tararea

**Quién es.** Niño de Lunaris (23,20), rescatado de la Niebla —aparece cuando el jugador caza su primer lobo—. Es el personaje-temperatura del valle: cuando Teo tararea, la esperanza hace baño de sol.

**Qué quiere.** Pertenecer. Sus frases son las de un niño que aprendió a tener miedo antes que a tener costumbres: *«Yo soñé la Niebla antes de verla. ¿Eso es valiente o es raro?»*; *«Cuando la tarareo, la niebla no me pega tanto miedo»*; y su plan de vida completo: *«Cuando sea mayor quiero ser Portador. O panadero. O las dos cosas»*.

**Su arco.** El Acto III le arrebata justo lo que lo define —la nana: *«Anoche me la cantó la Niebla, del final al principio. Yo solo la repito para que no se pierda. Cuando la canto al revés, responde alguien»*— y el jugador se la devuelve enderezada con los otros dos ecos invertidos. Es la primera vez que el juego deja claro que enderezar un eco no es un gesto abstracto: es devolverle a un niño su canción de dormir. En el epílogo queda en el coro del valle, entre la taza llena de Brisa y las campanas gemelas.

**Cómo suena.** Corto, grave de niñez, imposible de no querer. La biblia fija su futuro como hilo abierto para la ampliación: el niño que tararea es, con el tiempo, el segundo Portador del valle — pero eso es otra canción.

---

### 4.6 EL HERALDO DE VESH — el emisario (antes de ser jefe)

**Quién es.** Emisario de la Orden, aparece en Lunaris (28,17) cuando el Portador toma su primer Eco. Llama «recipiente» al jugador y ejerce de voz de la Ciudadela: amenaza educada, teología de lance.

**Qué quiere.** Lo que le firmaron: *«Sube. Reúne las migajas de tu dios... y yo recogeré lo que quede de ti»*. Y vigila: *«Vesh oye todo lo que se firma con voz. Todo»*.

**Su función.** Es la sombra que crece: en el Acto IV se descubre que este emisario y la Última Nota son la misma línea de obediencia —el hombre que creyó que servir de nota era un honor y resultó ser un castigo—. Su ficha completa, como jefe, está en el capítulo 5.6; aquí basta su sello: nunca grita, nunca insulta, solo **recuerda tu nombre para otro**.
## 5. FICHAS DE PERSONAJES (II): ALIADOS LEJANOS Y ENEMIGOS

### 5.1 MARA, LA FARERA — la cerilla que no tembló

**Quién es.** Farera de la Costa de Bruma (7,19), última de una familia que lleva trescientas noches encendiéndole una cerilla a la esperanza a un faro muerto. Retrato de terquedad luminosa.

**Qué quiere.** Que el faro vuelva a ser de los barcos y no de la costumbre. Su introducción es de las mejores del juego: *«el faro lleva trescientos años apagado y mi familia lleva trescientas noches encendiéndole una cerilla a la esperanza. Mi abuelo juraba que el mar guarda las notas que el dios no pudo cantar. Yo digo que algo ha empezado a usarlas...»*.

**Su arco.** De custodia a vencedora. Cuando el jugador mata a la Sirena y le devuelve el Eco de las Mareas, Mara enciende el faro y pronuncia su frase-creed: *«Trescientos años, y esta mañana el mar se ha quedado sin hambre. Ven: ayúdame con la lámpara. La cerilla tiembla, pero la mano no»*. Paga con dos pociones y, sobre todo, con un cambio de estado del mundo: la interacción del faro pasa a decir *«la costa tiene permiso para volver»*. Su rumor nocturno (*«De noche, la lámpara aprende a temblar. Quédate cerca»*) y su presagio de terror (*«la marea devolvió un remo que nadie echó, seco por el extremo que no toca el agua»*) la mantienen humana: la valentía de Mara no es no tener miedo, es tenerlo a horario fijo.

**Cómo suena.** *«El mar susurra con voz prestada. No le respondas con tu nombre»*; *«Sé que lo hago cada noche... hay un hueco con forma de luz y no queda ni el olor a cerilla»* (cuando Merrow roba ayeres); y en el ayer: *«...una nota por vuelta, abuela...»*.

---

### 5.2 VULT, EL CAZADOR DE ECOS — el cartógrafo de la Niebla

**Quién es.** Dos veces personaje. De día, el cartógrafo afable de la Liga de Mercaderes en la Costa (30,32): *«La Liga no vende seda: vende certezas... un mapamundi con tu nombre en la leyenda vale más que una paga de por vida»*. De noche, tras el Acto III, en las Cumbres: un jefe opcional con su sombrero puesto, que te caza a ti y no a tu cuerpo.

**Qué quiere (el de noche).** Tu mapa. *«El mapa de tus pasos es su contrato»*, dice su subtítulo de banner. Es la Niebla hecha contable: no come nombres a lo bestia, los facturiza. Su ciclo de combate es de depredador profesional (ráfaga → embestida → salto sobre tu posición predicha) y su fase 3, el **MODO ACECHO**, se desvanece y reaparece a tu espalda: *«Vult entra en MODO ACECHO: no parpadees»*.

**Su arco.** Es el único antagonista del juego que puede terminar en redención en lugar de muerte: si sobrevive a tu canto, el epílogo lo muestra *«saludando con el sombrero de cartógrafo. La Liga facturará la escena»*. Su autoprofecía de día es una de las mejores líneas de presagio del juego: *«Si un día me encuentra usted lejos de esta costa, con otro título y sin libreta... no salude»*.

**Cómo suena.** *«Cartografío el silencio. Es el bioma más extenso de Aelthar»*; *«si me ves allá abajo, en la playa, cuando yo estoy aquí delante — no le compres. Aprendió mi letra»*.

---

### 5.3 LA ESPECTRO DE MERROW / NERA — la que buscaba su nombre

**Quién es.** La anciana-espectro de la plaza de Merrow (22,16), vecina más antigua de la aldea y no sabe cuánto. Su presentación es la definición del horror de la Niebla: *«...Yo era... yo me llamaba... (la anciana busca su nombre entre los pliegues del chal y no lo encuentra)»*.

**Qué quiere.** Lo mismo que todos en Merrow: saberse llamada. Su tarea al jugador es el catecismo del mundo: *«Los faroles no se encienden con fuego, Portador: se encienden con nombres dichos en voz alta»*.

**Su arco.** El más emocionante del juego. Cuando el jugador le entrega el Eco de los Nombres, el nombre vuelve y la escena se escribe sola: *«...Nera. Me llamaba Nera, y mi hijo la decía "madre Nera" como otros dicen "mañana clara"... es MÍO. Lo tengo»*. Después ya no para: dicta nombres en la plaza en el epílogo, presagia al Coro Roto (*«la Niebla está uniendo tres máscaras a pulso, cosidas con la nota del revés que la primera Portadora dejó caer»*) y pone guías al resto del mundo. En el ayer es la que era: *«...en el ayer aún lo sabía...»*; en el presente, la que vuelve a ser.

**Cómo suena.** *«Merrow no es mi nombre. Es el que quedó cuando se lo robaron»*; su presagio de las ventanas: *«las ventanas se abren solas, todas a la vez, como cuando una madre abre la casa para que entre el nombre de los hijos»*.

---

### 5.4 IVO, EL CAZADOR DE CUMBRES — el gruñón que cuenta

**Quién es.** Cazador con ballesta en las Cumbres (27,37), de modales escasos y pan duro, raíz bondadosa. Guardián de facto del paso: *«¡Alto ahí! ...aquí arriba los modales escasean y el pan está duro»*.

**Qué quiere.** Que la montaña deje de cobrarse gente. Es el testigo técnico de la zona: conoce al Gólem como se conoce a un vecino peligroso (*«El Gólem cuenta los coros bajo el hielo. No dejes que cuente el tuyo»*; *«Es hielo con memoria... No duerme, Portador: escucha»*).

**Su arco.** El escepticismo que se deja ayudar. Cuando el jugador le pide la resonancia de las cumbres para el coro de la Campana (q14), cuenta la escena que lo convirtió: *«Anoche ardieron las piedras sin leña... las voces bajo el hielo cantaron la última estrofa. La que nadie cantó... di "os toca cantar a vosotras", que eran tres hermanas y su hermano el pequeño, y el pequeño es el que no llegaba al final»*. En el epílogo apuesta a que *«la montaña desafina en los graves»* — el humor como forma de estar en paz.

**Su herida.** El Acto III le roba un recuerdo y lo deja a la deriva: *«La montaña cantó de vuelta... ¿o fue un sueño? Y ahora no sé decir cuál... Un cazador que duda de su memoria pierde el norte»*. Y su presagio de Ronda 7 es puro terror nórdico: *«esta mañana la ventisca repetía tu nombre por el paso... Lo probaba. Como quien prueba una llave que no es suya»*.

---

### 5.5 DORAN, DRUIDA DEL CÍRCULO VERDE — el que escucha la Niebla

**Quién es.** Druida del Bosque (36,24), miembro del **Círculo Verde**, la facción cuya herejía es escucha: *«El Círculo Verde no la combate: la escucha... es lo que había ANTES del canto»*. Invoca a la **Madre Espina** y defiende que el corazón del bosque está roto, no corrompido.

**Qué quiere.** Que el mundo cure de otra manera: sin lanzas. Es la tercera vía del debate del juego (Guardianes: cantar; Orden: matar; Círculo: escuchar), y el juego le paga el respeto de darle razón a medias: los lobos *«ya no saben para qué»* patrullan, la Madre Espina *«tiene roto el corazón, no la voluntad»*.

**Su arco.** Aliado de conversación más que de espada: premia con reputación al jugador empático (*rep_circulo_5*), se pierde su ayer en q12 (*«Las raíces respiran al revés, Portador... Alguien le enseñó al bosque a llorar hacia atrás»* — su eco invertido es el de la raíz) y en el epílogo queda como la conciencia verde del coro. La ampliación le debe una facción jugable completa (cap. 17).

---

### 5.6 LA GUARDA DEL PRIMER CANTO — el capellán de piedra

**Quién es.** El tercer capellán de la muralla de Lunaris, el que seguía cantando las horas cuando sus compañeros callaron, hasta que siguió cantando *«dentro de la piedra: las piedras cantan por mí cuando llueve»*. Aparece en la Cripta (21,24) tras el Acto III, custodiando la puerta de la Sala del Primer Canto. Retrato 'kael', lanza, paciencia de catedral.

**Qué quiere.** Cumplir la última guardia bien. No guarda la Sala contra el jugador: la guarda *para* el jugador, contra la prisa. Su contraseña es un poema: *«Dile que Brisa aún canta»*.

**Su arco.** Es el testigo que cierra el círculo de la Orden: cuenta quién fue Vesh el hombre —*«Porque Vesh no era cruel: era un hombre que VIO qué pasaba cuando el Canto tenía hambre... él quiso guardar una última nota por si el mundo, algún día, la necesitaba de nuevo. Es una obediencia vieja... ahora la Niebla le canta que la nota es SUYA, y él obedece. No lo odies. Rompe su barra... y escucha lo que canta debajo»*— y cuando el Heraldo cae, baja la lanza y el mundo la oye: *«(la Guarda deja la lanza en el suelo, y suena como suena una campana chica)»*. Es la Orden entera, perdonada en una escena.

---

### 5.7 VELMORA — la Primera Portadora

**Quién es.** La primera nota humana del Canto: la mujer cuyo ayer pagó la primera nota del dios, la primera Portadora, y ahora una presencia —retrato 'wisp'— que habla por la boca de Brisa. Lleva trescientos años *«de pie detrás de tus ojos, esperando que supieras escuchar»*.

**Qué quiere.** El relevo. No quiere venganza ni redención: quiere que alguien termine de devolver lo que ella empezó a pagar. Su confesión es el corazón teológico del juego: *«Yo fui la PRIMERA Portadora... la primera nota del Canto se pagó con MI ayer. La Orden no asesinó a tu dios por poder — mató por MISERICORDIA: mientras cantara, el mundo entero era su despensa. Dos verdades caben en una noche: fue un asesinato... y fue un regalo. Lo que ahora canta al revés con voz de mujer es mi nota, devuelta del otro lado»*.

**Su arco.** De presencia a rostro. En la Memoria VI tiende su ayer *«como quien tiende una taza»* y enseña la técnica que define al jugador: *«Guarda esta memoria AL REVÉS, Portador: cuando la Niebla te cante con mi voz, dila derecha y devuélvela a su dueña»*. En la Memoria VII, por fin, tiene cara —*«es la tuya»*: la del jugador, la que cierra los ojos y no busca a nadie detrás—. Su nombre, canonizado en esta biblia, lleva el nombre viejo del mundo (cap. 1.7): nació Velmora como nació el mundo, antes del Canto.

---

### 5.8 VESH, EL GRAN INQUISIDOR — el hombre que vio

**Quién es.** El fundador de la Orden, autor intelectual del deicidio, muerto hace trescientos años y presente en tres ecos: su voz desde la Ciudadela (*«Puedo oírte, Portador. Cada paso que das hacia el Eco resuena en MI ciudadela... tu nombre ya está escrito en ella, junto al de todos los que subieron»*), su orden póstuma en la Sala (*«si alguien reúne el Canto, baja y sé su última nota»*) y su retrato —'sombra'— en las conversaciones.

**Qué quiere (lo quería).** Que el mundo sobreviviera a su dios. La Guarda lo defiende a su manera: *«Vesh no era cruel: era un hombre que VIO qué pasaba cuando el Canto tenía hambre»*. La biblia fija su figura como la del hombre que cometió el crimen necesario y lo sabía: dejó la última nota *«por si el mundo volvía a necesitar una lanza»*, pero la dejó también con la piedad de quien sabe que una nota viva es mejor que una lanza nueva.

**Su arco (póstumo).** El Acto IV es su juicio. La Niebla lo procesa usando a su propio criado, y el mundo lo absuelve parcialmente usando al jugador: al romper la barra del Heraldo, *«escuchas lo que canta debajo»* — y lo que canta debajo es su última orden, dicha por amor. Su enigma mayor (la Lanza y «la segunda vez») es el motor del Acto V.

---

### 5.9 LOS JEFES COMO PERSONAJES

Los cuatro grandes de la campaña no son bestias: son lutos con barra de quiebre. Ficha breve de sus almas (los datos de combate están en el apéndice):

**El Guardián Hueco — «Custodio del Eco de la Voz» / «NO DUERME. NUNCA DURMIÓ.»** Fue *«el primer coro de Aelthar»*: un ser hecho de muchas voces que siguió cantando cuando el dios calló, *«hasta que su propia voz lo vació por dentro»*. Su grito de intro es la mejor imagen del juego: *«EL CORO... SE ME QUEDÓ DENTRO... Y NO CABE... LLEVA TRESIENTOS AÑOS SIN CABER... TÚ... LLEVAS... RESONANCIA... DÉJALA... AQUÍ... Y ASÍ... DESCANSAMOS... TODOS...»*. Pelea en tres fases y llama Sombras sin Rostro; su derrota es un alivio: *«El Guardián Hueco se deshace en notas de silencio...»*.

**La Sirena Abisal — «La que olvidó su nombre»** Duerme en el naufragio con *«la muñeca atada a una cadena rota —la arrastró trescientos años»*, corona de coral torcido y perlas de los ahogados. Aprendió a cantar escuchando a las vecinas de Merrow nombrar a sus hijos al alba, y su canto robado es de nombres. Su batalla es la más musical (salvas de notas, Canto del Abismo, coro de neumos, teletransporte acuático) y su muerte la más pía: *«se deshace en espuma que susurra un nombre...»*. Después de ella, Merrow puede volver a empezar.

**El Gólem de Escarcha — «Memoria de la montaña»** No es enemigo: es archivo. *«Es hielo con memoria... escucha. Lleva trescientos años contando los pasos de todo el que subió y no bajó»* (Ivo). Pelea con invierno: slams que dejan *«PIZCA DE HIELO»*, ventiscas que predicen tu posición futura, meteoritos de escarcha; muere quieto y honesto: *«El Gólem de Escarcha se aquieta: las cumbres recuerdan su canto»*. Es el jefe que más respeto inspira y el único al que la biblia permitiría haber sido aliado en otra vida.

**El Coro Roto — «Tres máscaras, una nota al revés»** El jefe opcional más perverso del juego: tres máscaras cosidas con la nota del revés de Velmora — **EL PULSO** (cian, anillos de orbes), **EL VERA** (dorado, rayos en cruz), **EL SILENCIO** (violeta, lluvia de notas) —, cada una cae al quebrar la barra y entra la siguiente. Su lore es de costura: *«la Niebla está uniendo tres máscaras a pulso, cosidas con la nota del revés que la primera Portadora dejó caer»* (Mera). Su fin es su boda: *«las tres máscaras del Coro Roto, ahora tres campanas gemelas, aprendiendo por fin a sonar juntas sin nadie que las una a la fuerza»*.

**El Heraldo · Vesh, la Última Nota — «Golpea como un silencio que cae»** El jefe final. Un hombre obediente convertido en castigo musical: *«Creí que era un honor. Es un CASTIGO, recipiente: la última nota se queda vibrando para siempre, sin poder bajar del aire, oyendo apagarse el resto del canto nota a nota... hasta sonar sola, para nadie»*. 640 de vida, quiebre de 130, en la Sala donde tu dios aprendió a cantar. Al caer no hay júbilo: hay respiración —*«el coro entero respira»*— y una Guarda dejando una lanza en el suelo.
## 6. ACTO I — «EL DESPERTAR» (q1–q5)

### 6.1 El arranque: tres noches de canto ajeno

El juego empieza donde todas las grandes historias de este mundo empiezan: con alguien dormido en un sitio que no es su casa. El Portador despierta junto al Santuario de Lunaris y la primera voz que oye es la de la Anciana Brisa, que le cuenta lo único que necesita saber: *«tres noches algo cantó bajo tus sueños... esa voz tiene dueño. Se llama Aelthar»*. La primera misión (q1, *«El Despertar»*) es solo eso: hablar con Brisa en la plaza. Es una misión de dos pasos y ninguna espada, y esa elección de diseño es el primer manifiesto del juego: en Aelthar, la aventura empieza con una conversación, no con un tutorial de combate.

Brisa le pone el mundo del revés en tres frases: el dios fue asesinado, el Canto se rompió en siete Ecos, la Niebla avanza comiendo nombres. Y le encarga el primer trabajo real: q2, *«Lobos en la Niebla»*. Su planteamiento es de biblia: *«La Niebla trae lobos del sur: han olido el Eco que duerme en ti, y esa hambre no se apaga sola. Caza a tres y el valle volverá a respirar. Habla con Toln si necesitas acero. Y, Portador... vuelve con vida: aquí los funerales ya no saben qué nombre decir»*. La misión cuenta las muertes con la flag `wolfKills` y enseña el combate contra los Lobos de Niebla —que fueron perros guardianes del valle, detalle que el juego suelta después, cuando el jugador ya ha matado varios, y que convierte cada aullido en una nota amarga—. La recompensa (50 coronas, dos pociones, +10 de reputación Guardianes) viene con la bendición de Brisa: *«El valle ya respira. Toma esto: coronas del fondo del pozo y una poción de la vieja receta»*.

### 6.2 El Bosque y la voz del dios

El paso al norte (q3, *«El Susurro del Bosque»*) lleva al Bosque Susurrante, donde los caminos cambian con la luz y la Niebla bloquea el norte. En la **Ruina Antigua** espera el primer momento grande del juego: el **Fragmento de Eco**, la primera vez que el dios habla. Su voz —espectro, rota, antigua— pregunta antes de dar: *«...¿quiéeeeen... despierta... el canto...? Ah... otro Portador. Otro pedazo de mí, extraviado en el tiempo... huelo el hueco que traes. Toma mi resonancia: alterna entre lo que fui y lo que soy»*. Al tocar el fragmento se desbloquea el cambio de época (Q): *«Resonancia despierta: pulsa Q para alternar entre presente y pasado»*. El acto entero gira en esa rueda: a partir de aquí, el pasado no es historia — es herramienta.

Con la resonancia despierta, el puente roto del río se cruza en el ayer (q4, *«La Cripta del Primer Canto»*), la Niebla del camino se disipa al cambiar de época, y la Cripta —el mapa que *«existe fuera del tiempo»*— abre su puerta oscura. Al fondo espera el primer jefe.

### 6.3 El Guardián Hueco y el Eco de la Voz

El **Guardián Hueco** («NO DUERME. NUNCA DURMIÓ.») es la primera clase de lo que son los enemigos en este mundo: un desastre de hace trescientos años que sigue ocurriendo. Fue el primer coro del mundo; cuando el dios calló siguió cantando hasta vaciarse. Su combate enseña la gramática de todos los jefes: tres fases, invocación de Sombras sin Rostro, ondas expansivas, y la **barra de quiebre** que hay que romper para aturdirlo y rematarlo. Su grito de intro (*«EL CORO... SE ME QUEDÓ DENTRO... Y NO CABE... LLEVA TRESIENTOS AÑOS SIN CABER...»*) es la tesis del Acto I: los enemigos de la Niebla no quieren matarte, quieren que les des lo que tú tienes de más — voz, nombre, ayer — para poder descansar.

Al caer, deja el altar libre: el **Eco de la Voz**, primer Eco mayor. Su texto de objeto es la primera promesa cumplida: *«Primer Eco de Aelthar. La melodía principal ahora lleva tu nombre»*. Y su voz se queda en el jugador como una asignatura: *«El primer canto vuelve a nacer entre tus manos y, por un latido, oyes a todas las cosas escuchando... "Cuando el miedo te hable, canta más alto."»*. Recompensa del hito: +1 punto de habilidad, +10 reputación, vida al máximo, y la **Memoria I · La nana**, primera pieza del pasado del propio jugador.

### 6.4 El cierre: seis Ecos y un mar que llama

El Acto I se cierra contando (q5, *«Ecos de Esperanza»*). Brisa recibe al Portador con la contabilidad de la esperanza: *«El Eco de la Voz... después de 300 años vuelve a sonar en Lunaris... quedan seis Ecos... y la Niebla seguirá avanzando mientras no los reúnas»*. Y abre el mundo hacia el sur con el mejor gancho del juego, el que convierte una costa en una promesa: *«el mar llama: los pescadores juran oír una voz entre la bruma de la Costa, al sur de Lunaris... Baja por el camino del sur y busca a la farera: su faro lleva 300 años apagado y las cerillas se agotan»*.

Resumen de arquitectura narrativa del Acto I — el juego planta aquí todo lo que cosechará después: la culpa de Toln (q2: «Habla con Toln si necesitas acero»), el oficio de Portador como peligro real (el eco del «primer Portador» que no volvió), la voz del dios que miente o duda (*«recuerda que la voz de un dios no siempre dice la verdad»*, advierte la intro), la Niebla como aprendiz (bloqueo que se disipa en el ayer) y el tono —que el miedo se canta, no se huye— fijado para siempre en la cita de Brisa.
## 7. ACTO II — «LAS NOTAS PERDIDAS» (q6–q10)

### 7.1 El mar que guarda las notas

El Acto II abre el mapa en tres direcciones y le da al juego su segunda voz: la del agua. Brisa señala el camino del sur y la **Costa de Bruma** recibe al jugador con su cartel-manifiesto: *«Costa de Bruma. Al sur y al este, el mar. Todavía susurra con voz prestada: no le respondas con tu nombre»*. El aviso no es decorativo: en este mundo, dar tu nombre a lo que lo pide es firmar. La primera cita del acto es q6 (*«El Rumor del Mar»*): encontrar a **Mara, la farera**, cuya familia lleva trescientas noches encendiendo cerillas a la esperanza sobre un faro muerto.

Mara planta el misterio del acto con la sabiduría de su abuelo: *«el mar guarda las notas que el dios no pudo cantar. Yo digo que algo ha empezado a usarlas...»*. El juego confirma que sí: en el naufragio del este duerme algo que canta con notas ajenas. La mecánica de exploración de la costa —bruma que avanza, muelle que solo existe en el ayer, neumos que escupen agua a distancia— convierte la zona en un mapa de paciencia: aquí no se corre, se escucha.

### 7.2 La Sirena sin Canto

q7 (*«La Sirena sin Canto»*) lleva al naufragio, donde la marea *«no se lleva»* la nave. Al acercarse, el aviso: *«La Sirena te ha visto...»*, y el banner de la primera jefa de agua: **SIRENA ABISAL — La que olvidó su nombre**. Su combate es el más lírico del juego: notas de hielo, salvas de marea en abanico, el **CANTO DEL ABISMO** (anillo de 8 notas + salva dirigida + slowmo), coro de neumos de marea, teletransporte acuático y la **MAREA DOBLE** en su última fase. Es también el primer jefe que castiga pegarse: retrocede si la apuras a menos de medio metro y, aturdida, *«suelta notas liberadas»* que ascienden — la mecánica cuenta su historia: cada golpe correcto le devuelve música propia.

Su muerte es la escena más elegante del juego: *«La Sirena Abisal se deshace en espuma que susurra un nombre...»*. Con el altar libre llega el **Eco de las Mareas** (*«Segundo Eco de Aelthar. El mar vuelve a tener a quién cantarle»*), +1 punto de habilidad, +10 de reputación, y la **Memoria IV · El farero que contaba barcos**. Y llega la recompensa humana: Mara enciende el faro. La escena exacta merece citarse entera porque es el tono del juego en estado puro: *«...Trescientos años, y esta mañana el mar se ha quedado sin hambre. Ven: ayúdame con la lámpara. La cerilla tiembla, pero la mano no»*. Desde ese día, la interacción del faro dice: *«El faro de Mara arde de nuevo: la costa tiene permiso para volver»*.

### 7.3 La aldea que olvidó su nombre

q8 (*«La Aldea que Olvidó su Nombre»*) abre el este de la costa: la **Aldea de Merrow**, *«La que la Niebla borró»*. Es el capítulo más quieto y más profundo del acto. La aldea está viva de gente y muerta de nombre: espectros sin nombre que pasan a tu lado (*«Salúdalos; no muerde quien fue cortés»*), un pozo seco, cuatro casas que solo tienen techo en el ayer, y tres **Faroles del Recuerdo** que el juego explica con su catecismo: *«Los Faroles del Recuerdo no se encienden con fuego. Se encienden con nombres, y solo en el ayer»*.

La dueña de la misión es la **Espectro de Merrow**, que busca su nombre *«entre los pliegues del chal»* y no lo encuentra. Encender los tres faroles (cada uno con su cambio de época y su toast *«Farol encendido (n/3)»* — *«Un nombre vuelve»*) abre el Eco de los Nombres, el primer **Eco menor** nacido del propio mundo y no del dios: *«Un Eco menor nacido de los faroles de Merrow. Guarda los nombres que la Niebla se llevó»*. Al entregarlo, la escena: *«...Nera. Me llamaba Nera, y mi hijo la decía "madre Nera" como otros dicen "mañana clara"... es MÍO. Lo tengo»*. El Acto II se gana su lugar en la memoria del jugador no por el jefe, sino por ese nombre.

### 7.4 La cumbre que aprendió a escuchar

q9 (*«La Cumbre del Segundo Canto»*) sube al noreste del Bosque: las **Cumbres Heladas**, *«El frío que aprendió a escuchar»*. Aire que corta los nombres, hielo resbaladizo de inercia real, un lago que congela coros y el segundo gran jefe del acto: el **GÓLEM DE ESCARCHA — Memoria de la montaña**, dos fases de invierno aplicado (slams con *«PIZCA DE HIELO»*, lanza de cristales, embestida que rebota en los muros dejando surco, ventiscas que predicen tu posición futura, CORAZÓN DE HIELO, METEORITO DE ESCARCHA). Su muerte es de las más serenas: *«El Gólem de Escarcha se aquieta: las cumbres recuerdan su canto»*.

El **Eco de las Cumbres** (*«Tercer Eco de Aelthar. Las montañas recuerdan el invierno sin frío»*) viene con la historia más honda del mapa en boca de su propia voz: *«Las montañas aprendieron a guardar voces bajo el hielo... Todavía se turnan, Portador: todas las noches, en el mismo orden, aunque ya nadie las oiga»*. Y con la **Memoria V · El invierno del silencio**. *(Nota de canon: el título dice «Segundo Canto» y su diálogo dice «el tercer canto»: la cuenta de los Ecos no cuadra entre el título y la entrega — la biblia lo documenta en el apéndice como rareza deliberada: el mundo cuenta mal lo que le falta.)*

### 7.5 El cierre: la Ciudadela también escucha

El acto se cierra con Brisa (q10, *«Dos Voces más Fuertes»*, +60 coronas) y la contabilidad: *«Dos voces más... tres Ecos de siete. La Niebla retrocede en el mapa de los Guardianes... Pero el Heraldo tenía razón en una cosa, Portador: la Ciudadela también oye tu melodía ahora»*. La frase funciona como cambio de clave: el Acto II fue el mundo volviendo a sonar; el Acto III será el mundo sonando mal. Y deja al jugador en la puerta con dos opciones de eternidad: terminar la demo o quedarse — *«Aún no. Queda mundo por escuchar»* —, porque desde esta ronda el juego ya no es demo: es casa.

Arquitectura del acto: el Acto II introduce el patrón de oro de la saga — zona nueva → misterio con voz propia (Mara / la Espectro / Ivo) → jefe que es un luto → Eco que devuelve algo más grande que poder → frase de estado del mundo que cambia para siempre (el faro, el nombre, el orden de los turnos bajo el hielo) —. Todos los actos siguientes son variaciones de este compás, y la ampliación debe respetarlo como quien respeta un ritmo.
## 8. ACTO III — «EL CANTO AL REVÉS» (q11–q13)

### 8.1 El mundo suena mal

El Acto III empieza con un síntoma, no con una misión. Brisa, al alba: *«¿Lo oíste anoche, Portador? El Canto sonó AL REVÉS: las notas de Aelthar bajaron cuando debían subir. Toln jura que su forja cantó su nana del final al principio... esta noche se han torcido tres ecos, y los ecos torcidos llaman a la Niebla»*. Es el acto del diagnóstico: hasta ahora el jugador restauraba cosas que faltaban; ahora tiene que entender por qué lo presente se está estropeando.

q11 (*«El Canto al Revés»*) lo manda a la forja, donde Toln da la definición técnica del mal: *«el yunque templó al revés: el filo salió ROMO... Un canto al revés no es una canción, Portador: es una puerta abierta del otro lado. Enderézalos antes de que aprendan la letra»*. Los tres **Ecos Invertidos** son tres memorias torcidas con dueños y sentimiento: la nana de Teo (*«Anoche me la cantó la Niebla, del final al principio. Yo solo la repito para que no se pierda. Cuando la canto al revés, responde alguien»*), la raíz del Bosque (*«Las raíces respiran al revés, Portador... Alguien le enseñó al bosque a llorar hacia atrás»*) y la marea de la Costa (*«Anoche la marea devolvió dos barcos que se hundieron hace treinta años. Enteros, Portador. Con sus nombres pintados por DENTRO»*). Enderezarlos (en cualquier orden, flags `ecoInvTeo/Doran/Mara`) paga 60 coronas y una poción, pero el pago de verdad es la tesis del acto, dicha por Brisa: *«la Niebla no está robando el Canto. Lo está APRENDIÉNDOLO. Nota a nota, al revés... Alguien le enseña. O algo lo recuerda»*.

### 8.2 La aldea sin ayer

q12 (*«La Aldea sin Ayer»*) es el golpe fino. Merrow amaneció *«sin recuerdos»*: no muerta, **VACÍA**. Los vecinos viven, trabajan, saludan — y no saben que sabían. Brisa pone la regla: *«sin ayer no hay mañana que esperar»*. El jugador recorre la aldea devolviendo tres recuerdos de los cuatro posibles (Mera, Mara, Ivo, Vult — flags `recMera/recMara/recIvo/recVult`), y cada devolución es una lección de lo que cuesta estar vacío: Mera sin nombre prestado (*«esta mañana la boca me lo devuelve vacío»*), Mara sin la noche de la cerilla (*«hay un hueco con forma de luz y no queda ni el olor a cerilla»*), Ivo dudando de su norte (*«Un cazador que duda de su memoria pierde el norte»*), Vult con el pergamino en blanco (*«es un día que NO PASÓ... quien coma días ajenos... acabará comiendo los tuyos»*). Pago: 80 coronas y la certeza de que el enemigo ya no come pueblos: come **mañanas**.

### 8.3 Velmora: la revelación central

q13 (*«La Primera Portadora»*) es el corazón del juego entero. Brisa avisa: *«Velmora te observa. Lleva tres noches de pie detrás de tus ojos, esperando que supieras escuchar. Habla. Yo haré de puerta»*. Y la presencia habla por su boca, en la conversación más importante del juego:

*«Aelthar no murió por su PODER. Murió por su HAMBRE. Cada nota del Canto le costaba un ayer del mundo —un día entero de vidas ajenas, comido y digerido en melodía—»*.

Y luego la confesión personal: *«Yo fui la PRIMERA Portadora... la primera nota del Canto se pagó con MI ayer. La Orden no asesinó a tu dios por poder — mató por MISERICORDIA: mientras cantara, el mundo entero era su despensa. Dos verdades caben en una noche: fue un asesinato... y fue un regalo. Lo que ahora canta al revés con voz de mujer es mi nota, devuelta del otro lado»*.

El juego deja al jugador la decisión que ramifica reputaciones y epílogos: **LA VERDAD** (*«La verdad es de los Guardianes: la Orden mató por misericordia, y Brisa debe saberlo»* → +10 Orden, −5 Guardianes, *«Contaste la verdad: la Orden de Vesh pronuncia tu nombre con respeto»*) o **EL SILENCIO** (*«La Orden guardó su secreto trescientos años. Que lo siga guardando»* → +10 Guardianes, −5 Orden, *«Callaste: los Guardianes del Canto conservan su verdad intacta»*). No hay opción correcta; hay opción de carácter. La biblia lo anota como el mejor diseño moral del juego: la misma información, dos dueños legítimos.

### 8.4 El Guardián recordado

La revelación abre la puerta del subterráneo del acto: Velmora teletransporta al jugador a la Cripta (*acto3_subir*) para enfrentar al **Guardián recordado** — el élite del acto, un Guardián sacado *«fuera del tiempo»*: *«El Guardián recordado despierta: ROMPE SU BARRA DE QUIEBRE»*. Es el examen final del gramática aprendida en el Acto I: mismo tipo, otra intención, otra hora. Su derrota (*«El Guardián recordado se aquietó: vuelve con la Anciana Brisa»*) paga 100 coronas, la **Memoria VI · El Canto al Revés** — la lección magistral de Velmora: *«Guarda esta memoria AL REVÉS, Portador: cuando la Niebla te cante con mi voz, dila derecha y devuélvela a su dueña»* — y la flag `acto3Done`.

El cierre es la reflexión de Brisa, que ya no es la mentora del Acto I sino la compañera de guardia: *«...Trescientos años cantándole a un dios hambriento y a una Orden misericordiosa, y nosotros en medio, con el canto partido. La primera Portadora y esta vieja: a todas nos canta la misma Niebla»*. Con `acto3Done` el mundo abre sus últimas capas: la **Guarda del Primer Canto** aparece en la Cripta, y el altar libre empieza a cantar al revés — si el jugador se acerca, despierta el jefe opcional **El Coro Roto** (*«El altar libre canta al revés... EL CORO ROTO despierta»*).

Arquitectura del acto: es el único de los cuatro que no añade mapa nuevo — y es a propósito. El Acto III demuestra que Aelthar puede asustar con lo ya conocido: los mismos mapas, torcidos. Para la ampliación, la lección de diseño es esta: el miedo fino no necesita zonas nuevas, necesita **reglas nuevas sobre zonas viejas**.
## 9. ACTO IV — «EL ÚLTIMO CANTO» (q14–q16)

### 9.1 Las Campanas de Antes

El acto final empieza con una idea imposible de herrero. Brisa abre: *«Desde que enderezaste los tres ecos, el silencio tiene miedo de nosotros... su maestro tiene cara de hombre... Anoche Toln vino con una idea imposible: el metal de su forja... quiere ser CAMPANA»*. q14 (*«Las Campanas de Antes»*) convierte la forja en obstetricia. Toln pone la mano del jugador sobre el yunque: *«¿Sientes? Lleva trescientos años esperando... Los niños lo llaman el eco del pozo... Anoche, cuando el coro del valle cantó tus tres notas, el metal LLORÓ en la fragua. Una campana no se hace, Portador: se cría»*.

Para criarse, la campana necesita coro, y el coro son las zonas ya salvadas volviendo a cantar: la voz de Merrow (Nera cuenta cómo la Sirena aprendió a cantar de las madres de la aldea: *«La que cantaba bajo la quilla ya no canta para la Niebla: su voz quedó suelta, como un farol sin gancho... Merrow fue su primer dueño... La Sirena aprendió a cantar escuchando a mis vecinas nombrar a sus hijos al alba»*, flag `camMera`) y la resonancia de las Cumbres (Ivo y la estrofa que nadie cantó: *«las voces bajo el hielo cantaron la última estrofa. La que nadie cantó... di "os toca cantar a vosotras", que eran tres hermanas y su hermano el pequeño, y el pequeño es el que no llegaba al final»*, flag `camCumbres`). El resultado es el objeto más importante del juego: **La Campana del Ayer** — *«La campana que Toln crió con el metal que recuerda. Reparte las horas, llama al coro de antes y da nombre al valle»*.

### 9.2 La Guarda y la Sala del Primer Canto

Con la campana criada, q15 (*«La Sala del Primer Canto»*) baja por fin a la Cripta del presente — no del pasado: del ahora. Allí espera la **Guarda del Primer Canto**, el tercer capellán, que cuenta su vida y la del enemigo en dos parlamentos magistrales. De sí misma: *«...yo era el tercer capellán de la muralla de Lunaris —el que cantaba las horas—. Cuando el Canto murió, mis compañeros callaron y yo seguí... hasta que seguí dentro de la piedra: las piedras cantan por mí cuando llueve... aquí dejó Vesh, el Gran Inquisidor, su Última Nota... por si el mundo volvía a necesitar una lanza. Ahora se hace llamar El Heraldo, y la Niebla le presta la voz. ¿Abro?»*. Y de Vesh: *«Porque Vesh no era cruel: era un hombre que VIO qué pasaba cuando el Canto tenía hambre... él quiso guardar una última nota por si el mundo, algún día, la necesitaba de nuevo. Es una obediencia vieja... ahora la Niebla le canta que la nota es SUYA, y él obedece. No lo odies. Rompe su barra... y escucha lo que canta debajo»*. La frase-llave de la puerta: *«Dile que Brisa aún canta»*.

Antes del jefe, el juego da al Heraldo su última escena de emisario en Lunaris, y es la mejor escritura del juego: *«Mi Gran Inquisidor dejó una orden escrita antes de morir: "si alguien reúne el Canto, baja y sé su última nota". Yo creí que era un honor. Es un CASTIGO, recipiente: la última nota se queda vibrando para siempre, sin poder bajar del aire, oyendo apagarse el resto del canto nota a nota... hasta sonar sola, para nadie»*.

### 9.3 El Heraldo · Vesh, la Última Nota

La campana abre la Sala (*acto4_subir*, flag `acto4SalaAbierta`): *«la habitación donde tu dios aprendió a cantar... la primera nota, la que costó el ayer de Velmora»*. El jefe final — **EL HERALDO / Vesh, la Última Nota**, 640 de vida, quiebre de 130, descripción de combate: *«Golpea como un silencio que cae»* — pelea con la obediencia de quien lleva trescientos años cumpliendo una orden. Al quebrar su barra, el juego cumple la promesa de la Guarda: *«quebra su barra y oirás lo que canta debajo»* — y lo que canta debajo es la orden dicha con amor: *«baja y sé su última nota»*.

Su caída no es una explosión: es un descanso. *«Vesh, la Última Nota, se aquietó: el coro entero respira»* (+1 poción, +80 coronas, +120 de pago de la misión). Y el gesto que cierra trescientos años de Orden: *«(la Guarda deja la lanza en el suelo, y suena como suena una campana chica)»*. Brisa remata: *«Así que el Heraldo era solo un hombre con una obediencia vieja... y la Nota ya es solo una canción triste... Queda una sola cosa, y no es una misión: es un ECO. El que elegiste, el que has ido siendo mientras devolvías nombres, ayeres y horas»*.

### 9.4 El Eco que Elegiste: los tres epílogos

q16 (*«El Eco que Elegiste»*) no es una misión: es un espejo. El juego rutea la despedida según la decisión del Acto III (flags `acto4RepOrden`/`acto4RepGuard`):

**El epílogo de la verdad** (si contaste): *«La verdad, entonces. (Brisa no sonríe: descansa) Contaste lo que Velmora te confió y la Orden dejó de ser un puño cerrado: por primera vez en trescientos años, los de la Ciudadela lloran a sus muertos en voz alta, y las lanzas descansan porque una verdad pesa menos que un secreto. Hay quien te lo reprocha... Pero el Eco que elegiste es este: una verdad con el suelo mojado de lágrimas viejas. El Último Canto se canta con ella... o no se canta»*.

**El epílogo del silencio** (si callaste): *«El silencio, entonces. (Brisa sí sonríe, y es como ver llover sobre el río) Guardaste el secreto de la Orden y los Guardianes conservaron su causa... Hay quien dirá que mentiste al mundo con tu callar. Yo digo que elegiste a quién darle el peso... El Eco que elegiste es este: un silencio que suena, como el de una casa vacía donde aún se guarda la taza llena. El Último Canto se canta con él... o no se canta»*.

**El epílogo neutro** (sin decisión): *«Hazlo como quieras, Portador: callado o a gritos, el Canto ya es tuyo... Tres ecos devueltos, tres campanas criadas, una Sala abierta y una Nota aquietada. Lo que fuiste haciendo mientras caminabas... eso es el Último Canto. Solo falta ponerle letra. ¿La tuya?»*.

Y entonces suena el **final dinámico**, el mismo para todos y distinto según lo que hiciste — el juego compone el texto con la Campana repartiendo la primera hora, el pozo devolviendo un coro, y la Niebla, *«que tantas letras robó»*, quedándose a escuchar *«quieta, como un perro viejo al que por fin le cantan lo suyo»*. Y la frase que define a este héroe: *«el Canto de Aelthar no volvió porque un héroe lo buscara. Volvió porque alguien, paso a paso, fue devolviendo lo que le iban dando: una nana, una casa, un faro, un invierno, un canto al revés. Ese es el Eco que elegiste. Ese eres tú. Que suene»*.

Dos estrofas opcionales se añaden si el jugador cazó los jefes opcionales: el Coro Roto tañendo *«en tres voces distintas... ahora tres campanas gemelas, aprendiendo por fin a sonar juntas sin nadie que las una a la fuerza»*, y Vult, *«saludando con el sombrero de cartógrafo. La Liga facturará la escena»*. El juego termina donde empezó: con una elección — *«(Subir el telón del Último Canto: terminar el viaje)»* o *«(Quedarse: el mundo aún tiene mañanas que nombrar)»* — y con Brisa en la puerta de su casa, que tiene *«una taza llena y trescientas historias nuevas»*.

Arquitectura del acto: el Acto IV convierte el endgame en gratitud. No hay revelación nueva que salvar sino deuda que cerrar: cada zona visitada viene a cantar, cada NPC devuelto firma el final, y hasta los enemigos opcionales tienen su estrofa. Para la ampliación, el estándar queda fijado: **un final de Aelthar se mide por cuántas cosas que el jugador devolvió vuelven a nombrarlo**.
## 10. LAS SIETE MEMORIAS DEL PORTADOR

El sistema de **Memorias** es el diario íntimo del juego: siete vitrales narrativos (`memoryReveal`, overlay *vitral-eco*, 5,5 segundos + sfx propio) que reconstruyen el pasado del Portador por trozos, como quien recupera una canción de memoria. Se conceden por dos vías —al tomar Ecos mayores, y por *watchers* del mundo (pisar un lugar, matar un jefe)—, y en el Diario las bloqueadas muestran pistas en vez de silencio (*«Una nana medio oída te persigue desde el valle...»*). Esta es la serie completa, con su texto y su lectura.

---

**MEMORIA I · La nana** — *(al tomar el Eco de la Voz)*
*«Una voz te arrulla junto al río y tararea la melodía que llevas silbando desde que despertaste. No ves su rostro: solo el vaivén del chal, y la Niebla deteniéndose a escuchar, quieta como una oyente. La melodía la conoce. La canta contigo... y tú nunca se la enseñaste.»*

La pieza fundacional. El jugador lleva tarareando desde el minuto uno una melodía que no aprendió de nadie — el juego se la puso al mundo entero sin decirlo—. La Niebla como oyente quieta anticipa su naturaleza de aprendiz. Y el chal es el mismo del que la Espectro de Merrow busca su nombre: la biblia fija que la madre del Portador y la generación de Nera comparten tela, gesto y época.

**MEMORIA II · La casa junto al río** — *(watcher: tras el Eco de la Voz, al pisar el Bosque)*
*«Una casa de piedra bajo un sauce llorón. Huele a pan y a tinta. En el umbral, dos tazas: una siempre llena, humeando... La Niebla espera tras la valla, paciente. Esta casa estaba en Lunaris. Antes.»*

El misterio doméstico. Dos tazas: quien servía la segunda taza esperaba a alguien. *«Huele a pan y a tinta»*: panadería y escritura — una casa que vivía de alimentar y de nombrar. La pista se paga al final del juego: en el epílogo, Brisa dice tener *«una taza llena»* — la casa del recuerdo y la casa del final sirven la misma taza. El sauce llorón es marcador geográfico: las casas de Lunaris del pasado tienen sus sauces.

**MEMORIA III · La madre sin rostro** — *(watcher: al derrotar al Guardián Hueco)*
*«Manos que cosen una marca de onda en tu pañoleta. "Cuando no recuerdes quién eres —dice una voz que ya casi no oye su propio canto—, acuérdate de lo que has hecho." ...jurarías que ella también intenta verte la cara... y no puede.»*

La pieza más doliente. La madre cosía en la pañoleta del niño la **marca de onda** —la insignia de los que cantan, la misma que el Santuario graba en sus anillos—. Su frase es la ética del juego comprimida: la identidad no se recuerda, **se hace** (*«acuérdate de lo que has hecho»*). Y el detalle insoportable: ni ella ve al hijo — la Niebla ya le había comido caras. **ENIGMA ABIERTO:** qué fue de ella; la ampliación del Acto V propone respuesta (cap. 14).

**MEMORIA IV · El farero que contaba barcos** — *(al tomar el Eco de las Mareas)*
*«Un faro pequeño y un hombre delgado que encendía la lámpara con una cerilla y una canción. "Cada barco que pasa —decía— es una nota que el mar se lleva. Yo solo pongo la luz para que la orquesta no se pierda." Bajas la cerilla. La luz no era tuya, pero la melodía, sí.»*

La pieza del linaje del oficio. El farero que contaba barcos es abuelo o bisabuelo de Mara —la cerilla es el apellido de la familia—, y la frase (*«la luz para que la orquesta no se pierda»*) es la teoría completa del mundo: todo el que mantiene una señal está manteniendo una partitura. El jugador *baja la cerilla* en el recuerdo y la levanta en el juego cuando Mara enciende el faro: la Memoria IV y q7 son la misma escena vista desde dos siglos.

**MEMORIA V · El invierno del silencio** — *(al tomar el Eco de las Cumbres)*
*«Nieve hasta las rodillas y una hoguera de pastores cantando por turnos para no dormirse. "Si el canto se apaga, el frío entra", decía el mayor. Una noche el viento se llevó las voces, y las montañas aprendieron a guardarlas bajo el hielo... esperando que alguien volviera a pedirlas.»*

La pieza del testigo indirecto. El Portador estuvo en las Cumbres antes de saber de sí: vio apagarse los turnos de canto. *«Si el canto se apaga, el frío entra»* es la física del mundo dicha por un pastor, y *«esperando que alguien volviera a pedirlas»* es la descripción exacta de lo que el jugador acaba de hacer al ganar el Eco: pedir las voces prestadas. Ivo es, probablemente, heredero de aquella hoguera; la biblia permite que el jugador elija creerlo.

**MEMORIA VI · El Canto al Revés** — *(cierre del Acto III)*
*«Una mujer sin rostro te tiende su ayer como quien tiende una taza: "Yo canté la primera nota, y el mundo pagó el día. Guarda esta memoria AL REVÉS, Portador: cuando la Niebla te cante con mi voz, dila derecha y devuélvela a su dueña." Por un latido el Canto suena entero —siete notas, un mundo, un dios con hambre— y luego vuelve el silencio... un poco más cerca de lo que estaba.»*

La pieza técnica y teológica a la vez. Velmora entrega su ayer —el gesto que da título a la Campana— y enseña la única técnica anti-Niebla que existe: **decir derecha lo que fue dicho al revés**. El vistazo del Canto entero (*«siete notas, un mundo, un dios con hambre»*) es la única descripción que tiene el jugador de cómo era el mundo sonando. Y la última línea (*«un poco más cerca de lo que estaba»*) es el reloj del juego: el silencio avanza mientras recuerdas.

**MEMORIA VII · El Último Canto** — *(epílogo del Acto IV)*
*«La mujer sin rostro por fin tiene cara: es la tuya, la que cierra los ojos y no busca a nadie detrás. "El Canto nunca fue mío —dices, y el valle entero te escucha nombrarte—: fue de todos los que lo cantaron. Yo solo devolví lo que me tocó devolver." Por una noche entera el mundo no necesita ayeres prestados: la Campana del Ayer reparte horas, el mar lee nombres sin borrarlos, y la Niebla —que tanto aprendió— aprende por fin a descansar. Silencio, sí. Pero de los buenos: el que queda cuando la canción ya está dentro.»*

La pieza final, y el final del misterio: la cara que faltaba es la del jugador. La lectura canónica: el Portador era el hueco —el que esperaba a la otra orilla de la taza— y al devolver, se rellena. El cierre (*«el silencio que queda cuando la canción ya está dentro»*) es la definición de paz de este mundo: no ausencia de sonido, sino presencia de canción aprendida.

---

**Lectura de conjunto:** las siete Memorias están ordenadas de fuera hacia dentro — primera el mundo (la nana ajena, la casa), luego la familia (la madre), luego el oficio (el farero, el invierno), luego la técnica (el revés) y al final la identidad (la cara propia)—. Ese orden es el orden del juego: primero se salva el mundo, y el último objeto que se salva es uno mismo. Para la ampliación, la regla de oro: **cada capítulo nuevo debe añadir, como mucho, una Memoria — y debe doler**.
## 11. ECOS MENORES, RUMORES Y CARTELES: LA VOZ DEL MUNDO

Además de la trama, Aelthar habla por tres canales menores que hacen el mundo grande: los **ecos menores** (18 inscripciones coleccionables con lore), los **rumores dinámicos** (burbujas de NPC según progreso y hora) y los **carteles** (props con leyendas literales). Este capítulo recoge los mejores y deja constancia del sistema entero.

### 11.1 Los 18 ecos menores

Cada mapa tiene tres o cuatro ecos menores que funcionan como microcuentas —dos o tres frases que contienen una tragedia entera—. Esta es la colección canónica, por mapa:

**Valle de Lunaris:** *«El pozo de los nombres»* («Antes de la Noche del Silencio, los aldeanos susurraban sus nombres al pozo para que el dios los tejiera en su canto. Ahora el pozo solo devuelve silencio»); *«La nieta del herrero»* («Toln aún forja todas las noches, aunque nadie compra. Dice que el metal recuerda el ritmo del martillo... y que algún día el canto volverá a necesitarlo»); *«Los Guardianes que aún cantan»* («Cada noche, tres capellanes subían a la muralla y cantaban las horas... Cuando el canto murió, dos callaron. El tercero aún canta: lo hacen las piedras por él, cuando llueve»).

**Bosque Susurrante:** *«La Madre Espina»* («...La Madre Espina no es mala: solo tiene roto el corazón»); *«El guardián de la niebla»* («Los lobos de niebla fueron una vez perros guardianes de Lunaris. Aún patrullan. Ya no saben para qué»); *«El primer Portador»* («Hubo otros antes que tú. Todos oyeron el primer Eco. Ninguno volvió de la Ciudadela. Prepara tu despedida, Portador»); *«La Rebelión de los Sordos»* («...los aldeanos se taparon los oídos con cera de abejas: "si el canto nos gobernaba, el silencio nos libera". Duraron un invierno... el silencio también se puede robar»).

**Cripta del Primer Canto:** *«El eco del guardián»* («El Guardián Hueco fue el primer coro de Aelthar... hasta que su propia voz lo vació por dentro»); *«El peregrino»* («...Este dejó su lámpara encendida para el siguiente. Aún arde»); *«La Lanza Muda»* («Aquí forjaron los Durn la Lanza que mató al dios: una lanza sin canto, sorda de nacimiento... sigue silbando en algún rincón del mundo... esperando la segunda vez»).

**Costa de Bruma:** *«El farero que no se dormía»* («...la lámpara siguió girando... pero la luz aprendió a temblar. Los barcos ya no buscan fuego en la costa: buscan permiso para volver»); *«Los barcos sin canción»* («...la Niebla Muda las apunta una a una en su lista de nombres. El mar guarda las notas que faltan: por algo todavía susurra»); *«La marea que borra nombres»* («El mar fue el primer archivo de Aelthar... La que duerme en el naufragio sabe dónde fueron a parar los nombres»).

**Aldea de Merrow:** *«El nombre que nadie dice»* («Merrow no es su nombre. Es el que quedó cuando la Niebla borró el verdadero, como quien roba un pañuelo y deja la mano fría...»); *«Los faroles del Recuerdo»* («...se encendían con nombres dichos en voz alta, uno por farol, uno por familia. Tres siguen esperando en el ayer...»).

**Cumbres Heladas:** *«El invierno del silencio»* («...bajo el hielo aún se oyen, si sabes escuchar de rodillas»); *«Los turnos de canto»* («...uno dormía y otro velaba su voz, para que el silencio no encontrara a nadie solo. La última noche cantaron todos a la vez. Nadie recuerda quién quedó para el alba...»); *«Las voces bajo el hielo»* («El lago no congela agua: congela coros... En los deshielos breves piden ayuda... en armonía. El Gólem los cuenta cada noche, como un pastor cuenta ovejas»).

**Lectura de conjunto:** los ecos menores son la historiografía de Aelthar — nadie escribe crónicas, se escriben ecos: breves, dolorosos, con cita final que corta. La ampliación debe mantener la regla de formato (dos o tres frases + remate) y la regla de fondo: **ningún eco cuenta una victoria; todos cuentan una espera que terminó bien o mal**.

### 11.2 Rumores dinámicos: el mundo cotillea

El módulo de vida del mundo (`worldlife.ts`) hace que los NPC suelten burbujas de rumor cada 8–14 segundos cuando el jugador está cerca y fuera de combate, con pools que dependen del progreso real, de la hora y de la época. Selección canónica, por voz:

- **Brisa:** *«Los lobos rondan al caer el sol. Ve con cuidado, criatura»* · *«El Bosque susurra nombres que ya no son de nadie»* · *«¡El Festival del Canto! Huele a pan y a primavera otra vez...»* (pasado) · *«El silencio pesa menos desde que llegaste, Portador»*.
- **Toln:** *«Una espada sin canto corta. Con canto, convence»* · *«¡Encargos del festival! Cola en la forja. Qué luz tan buena»* (pasado).
- **Teo:** *«Yo soñé la Niebla antes de verla. ¿Eso es valiente o es raro?»* · *«Cuando sea mayor quiero ser Portador. O panadero. O las dos cosas»*.
- **Mara:** *«El mar susurra con voz prestada. No le respondas con tu nombre»* · *«De noche, la lámpara aprende a temblar. Quédate cerca»*.
- **Nera/Mera:** *«Merrow no es mi nombre. Es el que quedó cuando se lo robaron»* · *«...dime un nombre y descanso...»*.
- **Ivo:** *«El Gólem cuenta los coros bajo el hielo. No dejes que cuente el tuyo»* · *«Las estrellas aquí bajan a beber al lago. Por eso faltan en los mapas»*.
- **Vult:** *«Cartografío el silencio. Es el bioma más extenso de Aelthar»*.
- **Doran:** *«La Madre Espina tiene roto el corazón, no la voluntad»*.
- **Ilwen:** *«Nimue... no, nada. Sigue el camino y cubre mi espalda»*.
- **Heraldo:** *«Vesh oye todo lo que se firma con voz. Todo»*.
- **Voces genéricas:** *«¿Oíste eso? Dicen que los ecos te siguen, Portador»* (presente) · *«¡El Festival! Canta algo, ¡que el dios te teje en el canto!»* (pasado).

Existe además una segunda capa de **rumores de interacción** (re-pulsar E sobre NPC, 10 por mapa, 60 en total), con joyas como: *«Antes había un puente al norte. En algún ayer sigue ahí, dicen»* (Lunaris) · *«Las flechas de Ilwen vuelven solas al aljaba. O eso jura ella»* (Bosque) · *«Si oyes una nana en la orilla, no es tu madre. Sigue andando»* (Costa) · *«Aquí las casas se construyeron cantando. Por eso resisten tanto»* (Merrow) · *«El polvo aquí no se posa: espera»* (Cripta).

### 11.3 Carteles: la señalética de un mundo que nombra

Los carteles (`sign`) son literatura de ruta. Colección canónica:

- Lunaris: *«Al norte: Bosque Susurrante. Cuidado con la Niebla»* / *«Al sur: la Costa de Bruma. El mar... todavía susurra»*.
- Bosque: *«Bosque Susurrante. Los caminos cambian con la luz»* / *«Cripta del Primer Canto. Aquí durmió la voz del dios»* / *«Al este: el paso de las Cumbres. Lleva abrigo, Portador»* / el secreto: *«Las flores del pasado no crecen en círculo por casualidad. Entre las raíces, apenas un hilo de voz... "...nimue... nimue..." Alguien duerme aquí debajo, y la Niebla la cuida como a una semilla. (Ilwen busca a su hermana... pero jura que no se llamaba así.)»*
- Costa: *«Costa de Bruma. Al sur y al este, el mar. Todavía susurra con voz prestada: no le respondas con tu nombre»* / *«Muelle viejo de Merrow. En pie solo cuando el ayer lo sostiene»*.
- Merrow: *«Aldea de Merrow. Pregunta por cualquiera: la Niebla respondió por todos»* / *«Los Faroles del Recuerdo no se encienden con fuego. Se encienden con nombres, y solo en el ayer»*.
- Cumbres: *«Paso de las Cumbres. Más arriba el aire corta los nombres por la mitad. Llévalos cerca del pecho»* / *«Hoguera de los pastores. Cantaban por turnos para no velar su voz en soledad. Nadie canta ya la última estrofa»*.
- Arena: *«Arena del Eco. Los caídos no juzgan: cuentan. La puerta del sur devuelve al valle con lo que trajiste»*.

### 11.4 Micro-interacciones con el mundo (tecla E)

El mundo responde a la interacción con líneas por mapa y época: el pozo (*«El pozo de los nombres devuelve solo silencio»* / *«Susurra un nombre al pozo: abajo, algo lo teje en el canto»*), las lápidas (*«Una lápida sin nombre. El musgo recuerda lo que los vivos olvidaron»*), las rocas del ayer (*«La talla aún vive en el ayer: una nota del Primer Canto»*), el agua por mapa (Costa: *«El mar susurra. No le respondas con tu nombre»* / en el ayer: *«La marea lee nombres en voz baja; hoy lee el tuyo»*), el naufragio (*«El naufragio cruje. Algo canta debajo, salado y vivo»* / *«El barco aún flota en el ayer: la tripulación canta al doblar el cabo»*), el faro según su estado (*«El faro está a oscuras. Nadie sube ya la lámpara»* / *«El faro de Mara arde de nuevo: la costa tiene permiso para volver»*), los faroles encendidos (*«El farol arde con un nombre dentro»*), los cofres vacíos (*«El cofre está vacío… pero huele a antes»*) y los restos de enemigos examinables (*«nada útil... solo silencio»*).

### 11.5 Presagios: la Niebla prepara el terreno

La capa más fina del terror del juego son los **presagios por mapa** — frases que los NPC sueltan antes de que pase nada, para que cuando pase ya estuviera escrito: Mara y el remo seco (*«la marea devolvió un remo que nadie echó, seco por el extremo que no toca el agua»*), Mera y las ventanas (*«las ventanas se abren solas, todas a la vez, como cuando una madre abre la casa para que entre el nombre de los hijos»*), Ivo y la ventisca (*«esta mañana la ventisca repetía tu nombre por el paso... Lo probaba. Como quien prueba una llave que no es suya»*), Vult y el imitador (*«si me ves allá abajo, en la playa, cuando yo estoy aquí delante — no le compres. Aprendió mi letra»*). La regla de diseño: en Aelthar el susto nunca sorprende — **se anuncia con ternura y se cobra con interés**.
## 12. LOS SISTEMAS AL SERVICIO DE LA HISTORIA

En Aelthar no hay mecánica sin teología. Este capítulo recorre los sistemas reales del juego y explica qué están contando.

### 12.1 El cambio de época (Q): el tiempo como lugar

La mecánica firma del juego se desbloquea narrativamente (el Fragmento de Eco), se ejerce con una tecla y se veta con poesía. El motor (`epochSwitch`) alterna presente/pasado con doble onda expansiva, flash teñido por destino (dorado = ayer, azulado = hoy), ráfaga de doce notas musicales y banners de pantalla: *«◆ EL PASADO ◆»* / *«◆ EL PRESENTE ◆»*. Los toasts son frases de estado del mundo: *«El pasado canta a tu alrededor»* / *«Vuelves al presente en ruinas»*. Y si el cambio trae un muro sobre el jugador: *«El mundo cambia a tu alrededor... y te aparta del muro»* — el ayer es hospitalario.

El sistema tiene cortesías de tensión: no se puede tejer tiempo bajo amenaza (*«Un enemigo te acecha: el tiempo no se teje bajo colmillos»*; *«El Eco calla: primero silencia lo que te muerde»*; con jefe: *«El jefe dicta el ritmo: este momento no se cambia»*), y la Cripta queda fuera de la mecánica (*«La Cripta existe fuera del tiempo»*): hay un lugar del mundo que ya es solo historia. El detalle más fino es el de las **huellas de localización**: tocar un lugar en su época deja marca persistente, y al aterrizar en la época contraria el mundo lo recuerda una vez (*«Ayer cruzaste el puente; hoy el río se lo disputa tablón a tablón»*; *«Las lápidas del presente, en el ayer eran flores: el suelo aún no sabe doler»*; *«Un farol arde en el ayer: alguna ventana de Merrow no está sola»*). El mundo te nota.

### 12.2 El mundo vivo: 240 segundos de cielo

El día dura cuatro minutos reales (`dayT = dt/240`, comienza en el alba) y pasa por cinco etapas oficiales con su paleta: **amanecer** (ámbar-rosa), **mediodía** (azul, nubes), **tarde dorada**, **crepúsculo** (violeta) y **noche** (azul profundo, luciérnagas, camino de luna sobre el agua, estrellas fugaces cada ~40 s). La noche tiene consecuencias: el aggro de todos los enemigos crece ×1,3 — *«de noche el silencio huele mejor»*—, y por eso existe el ritual de accesibilidad Shift+T: *«Esperas junto al camino hasta el alba...»*.

El clima respira por mapa y es determinista: Lunaris con pétalos en el pasado y niebla de amanecer; el Bosque con hojas eternas, polen, niebla por capas y su lluvia propia; la Cripta con tres haces de luz que respiran y motas doradas ascendentes; la Costa con bruma marina que avanza; las Cumbres con nieve por rachas y ventisca horizontal; Merrow, que no tiene clima sino **luz**: su amanecer entra desde el este como un frente cálido. La fauna completa el cuadro: aves que huyen a menos de 46 píxeles, mariposas de día, luciérnagas de noche, el pez determinista de la costa que salta en arcos con salpicadura — y fauna anunciada para la ampliación: gaviotas, cangrejos, gallinas, rapaces. Hasta los vientos tienen letra: *«La bruma se rasga: sal en el viento»*.

La lectura de diseño: el mundo vivo no es decorado, es **atmósfera con horario** — y en un juego sobre la memoria, que el mundo tenga rutinas es una forma de decir que merece salvarse.

### 12.3 La compañera: la T de la confianza

Ilwen (cap. 4.2) es la mecánica social del juego: órdenes tácticas con T (seguir / agresivo / defensivo), flechas elementales cíclicas, interposición del 50% con recarga de 6 s, avisos de flanco, y la orden guardada en la partida. Lo que la mecánica cuenta: en este mundo no se sube de nivel solo. La interposición es literal: *«interpone su cuerpo»* — el 50% del daño que te quita lo siente ella. El juego de rol más antiguo de todos: meterse en medio.

### 12.4 El balanceador: un mundo que cede

El balanceador dinámico (`balance.ts`) ajusta la dificultad en cinco niveles (Muy fácil → Muy difícil, multiplicadores 0,75/1,30 sobre vida enemiga) votando en ventanas de 10 segundos con señales honestas: muertes, pociones usadas, combates limpios. Cambia de nivel solo con dos votos consecutivos, con histéresis, toasts discretos (*«El mundo cede un paso atrás...»* / *«El mundo se torna más fiero...»*) y persistencia en `ecos-balance`. Su lectura de biblia: el mundo no quiere matarte, quiere que escuches hasta el final — la dificultad es un volumen, no un portero. En la Arena queda neutro: *allí* el mundo no cede, porque allí nadie está de paso.

### 12.5 La Arena del Eco: contar, no juzgar

El modo desafío (`challenge.ts`) vive fuera de la campaña con fotografía de estado y restauración byte-idéntica: duelos 1v1 a una vida sin pociones contra los tres jefes de campaña, y oleadas infinitas con escalado (×1,12 por oleada), Centinela del Eco cada tres rondas (un Guardián un 25% más blando), curación del 15% entre oleadas y hasta un Portador de Arena temporal para quien juega sin partida. Récords en tres llaves (mejor puntuación, top 3 de tiempos, logros de duelo). Su lema lo dice su cartel: *«Los caídos no juzgan: cuentan»*. La Arena es el único sitio del mundo donde el tiempo no se paga: por eso sus recompensas vuelven a la campaña (*«el oro de la arena se disuelve al salir»*, pero la XP *«es la recompensa del guerrero»*).

### 12.6 Logros y estadísticas: la contabilidad de la bondad

Los doce logros (`achievements.ts`) cuentan lo que este mundo valora: *Primer Canto* (primer enemigo), *Cazador de Ecos* (5 ecos menores), *Rompejefes* (3 jefes), *Corazón de Alba* (Acto I), *Notas Perdidas* (Acto II), *Canto al Revés* (Acto III), *El Último Canto* (Acto IV), *Invicto* (nivel 5 sin morir), *Rico* (500 coronas), *Alquimista* (10 pociones), *Viajero del Tiempo* (10 cambios de época), *Rondador* (duelo ganado con más del 70% de vida). Las diez estadísticas (`g.stats`) completan el retrato: enemigos derrotados, jefes, muertes, coronas ganadas y gastadas, pociones, cambios de época, distancia andada, tiempo jugado, memorias halladas. Ninguna celebra crueldad específica: se celebra **asistencia** — haber estado, haber caminado, haber devuelto.

### 12.7 Guardar: los santuarios y el canto guardado

El guardado del juego es diegético: se guarda descansando en los **Santuarios del Eco** (*«El cristal zumba con una melodía antigua. La luz del Santuario te envuelve: aquí puedes descansar, guardar tu canto... o dejarte llevar por él»* → *«Descansas junto al cristal. Partida guardada. Vida restaurada»*). Bajo el cristal, una infraestructura seria: la partida completa en `ecos-aelthar-save` (jugador, mapa, época, flags, misiones, cofres, ecos, oro muerto recuperable, compañera y su orden táctica, stats), más espejos y configuraciones en `ecos-stats`, `ecos-logros`, `ecos-desafio-récords`, `ecos-desafio-best`, `ecos-desafio-logros`, `ecos-balance`, `ecos-arbol`, `ecos-vol`. Toda lectura tolerante ante corrupción. La biblia anota la metáfora correcta: en Aelthar, guardar es **cantar tu estado a un cristal que lo recuerda por ti** — la memoria externalizada, que es el tema del juego hasta en su localStorage.
# SEGUNDA PARTE · LA AMPLIACIÓN: EL SEGUNDO CANTO

## 13. VISIÓN GENERAL DE LA AMPLIACIÓN

Esta segunda mitad de la biblia diseña lo que viene después del Último Canto. Parte de tres hechos canónicos que el propio juego dejó sembrados como deudas: la Lanza Muda *«sigue silbando... esperando la segunda vez»*; la hermana de Ilwen sigue al norte, donde *«ninguno volvió»*; y el final dinámico dice explícitamente que el mundo *«aún tiene mañanas que nombrar»*. La ampliación se llama **«El Segundo Canto»** y responde a la pregunta que el Heraldo dejó abierta: ¿qué fue «la segunda vez» para la que la Lanza esperaba?

Los principios de diseño, antes que el contenido:

1. **El verbo sigue siendo devolver.** Ninguna mecánica nueva puede ser de acumulación pura; cada sistema nuevo debe tener un gesto de restitución en su centro (el hogar restaura una casa, los gremios restauran oficios, la pesca restaura un archivo del mar).
2. **El norte como zona prohibida ya existe.** Todo el mundo apunta al sur y al este; la Niebla bloqueó el norte desde el primer día. Ampliar es abrir la puerta que el juego cerró con razón: la Ciudadela, donde *«ninguno volvió»*.
3. **Los sistemas existentes son sagrados.** El mundo vivo (cielo, clima, fauna), la estética de sprites y las reglas de época no se reescriben: se heredan. El ROADMAP MAESTRO del repo (`docs/ROADMAP.md`) ya reserva para esta capa las épicas de contenido (P3) y sistemas grandes (P4), incluido el multijugador como *futuro* tras cerrar bugs, game feel, menús y balance.
4. **La memoria sigue siendo la moneda.** El Acto V introduce un segundo recurso metafísico —el **Presto**, el tiempo todavía no vivido— para equilibrar el «ayer» del Acto III: si el Primer Canto pagaba con días pasados, el Segundo Canto se puede pagar con horas futuras... y eso es exactamente lo que no se debe hacer.

Contenido de la parte: el Acto V completo (cap. 14), la Nueva Partida+ (15), el Desafío 2.0 (16), los gremios de facción (17), las nuevas mecánicas de vida (18), el plan de implementación con el análisis de multijugador (19), y el glosario y apéndices (20–21).

---

## 14. ACTO V — «EL SEGUNDO CANTO»: LA REGIÓN DEL NORTE

### 14.1 El gancho: la carta que llegó después del final

La expansión empieza donde el juego terminó: en Lunaris, en paz, con la Campana del Ayer repartiendo horas. El gancho es un objeto y no una amenaza: **una carta sin remitente** que la Guarda del Primer Canto encuentra cosida en el forro de la lanza que dejó en el suelo. Está escrita con la letra de Vesh, y tiene una sola línea: *«Si la nota descansa, no era la última. Sube»*.

Con la carta se activa la pregunta que ningún personaje se había atrevido a hacer en voz alta: si la Última Nota se aquietó, ¿qué quedaba *abajo* de la Sala del Primer Canto? La respuesta canónica que esta biblia fija: **la Sala tiene sótano**. Debajo de donde el dios aprendió a cantar está donde el dios *aprendió a callar* — y en ese silencio antiguo la Niebla no pudo entrar, porque no había nada que comer: no hay ayeres donde nadie vivió. Ese sótano — **la Cuna** — es la puerta norte del mundo: desde ahí, el Canto original sigue sosteniendo la tierra del norte como una mano dormida bajo la nieve. La Niebla no conquistó el norte: lo * rodeó*. Por eso nadie volvió de la Ciudadela: no los mató la Niebla — los cambió la espera.

### 14.2 La región del Norte: tres mapas nuevos

**LA CUNA DEL CANTO (zona 18–24).** El sótano del mundo: una caverna de cristal donde las paredes guardan las formas de las primeras notas — ondas de piedra — y el aire suena solo si sabes caminar al ritmo. Es el mapa-hub del acto: aquí despierta el segundo Fragmento (ver 14.4), aquí se eligen las rutas, aquí está el único santuario nuevo. Su regla de época es la inversa del juego original: la Cuna solo existe en un tercer estado, el **aún** (ni presente ni pasado; el tiempo no la había estrenado). Mecánica nueva canónica: el cambio de época Q en la Cuna alterna entre *aún* y *presente*, y aterrizar en el presente **estrena** la zona — las primeras flores, el primer día — con todo lo que un mundo al estrenar su primer día tiene de conmovedor y de caro.

**LA CIUDADELA DE VESH (zona 20–26).** La ciudad-fortaleza que el juego prometió y no mostró: murallas que cantan los pasos de quien entra, salas con el nombre de los Portadores que no volvieron — el jugador encuentra su propio nombre ya escrito, como prometía la voz de Vesh (*«tu nombre ya está escrito en ella, junto al de todos los que subieron»*)—. Está habitada: la Orden sobrevivió, envejeció y **olvidó por qué espera**. Sus lanceros ya no son inquisidores: son vecinos con lanza, que llevan trescientos años cumpliendo una guardia cuyo motivo se lo comió la espera. La batalla por la Ciudadela no se gana matando: se gana **recordando** — cada distrito tiene una verdad que devolver (la biblioteca de la Orden, la sala de los nombres de los Portadores caídos, el archivo de la Lanza), y devolverla baja la guardia del distrito sin una sola espada, aunque siempre queda la opción mala.

**EL SILENCIO DE ARRIBA (zona 24–30).** Más allá de la Ciudadela, la meseta donde la Niebla no llegó porque no había nada que comer: ni nombres, ni ayer, ni eco — un páramo blanco donde el viento *«corta los nombres por la mitad»* (el cartel de las Cumbres ya lo anunciaba: *«Más arriba el aire corta los nombres»*). Es la zona final: aquí esperaba la Lanza, aquí vive el jefe de la expansión, y aquí el juego enseña su mecánica final — en el Silencio no puedes decir tu nombre: el HUD lo tapa, los NPC no te lo dicen, y cada vez que usas una habilidad con nombre propio, esa habilidad queda sin nombre un rato. Para pelear en el Silencio hay que aprender a pelear **sin anunciarse**.

### 14.3 La trama del acto: la segunda vez, contada

La historia del Acto V, en cinco movimientos:

1. **La carta y la Cuna.** El jugador baja a la Cuna, despierta el segundo Fragmento y descubre la primera verdad: el dios no murió entero. La Lanza atravesó *el costado* — la parte que cantaba. Lo que quedó callado no murió: **esperó**. El Canto original sigue sonando bajo el norte, tan lento que un siglo por nota. Es el Segundo Canto: no un renacimiento, una respiración lenta.
2. **La Ciudadela y la verdad de la Orden.** En la Ciudadela, la Orden esperaba esto. Vesh no dejó la carta por amor ni por estrategia: la dejó porque *lo sabía* — su Lanza solo era capaz de matar aquello que canta, y al matar al dios hizo lo único que un silencio teme: enseñarle que se puede. La orden póstuma completa (el juego solo citó su mitad: *«si alguien reúne el Canto, baja y sé su última nota»*), en esta expansión se cita entera: *«...y si el Canto vuelve a necesitar lanza, recuerda que la lanza sorda era mía: devuélvele el silencio, no el mundo»*. La Orden no esperaba para matar otra vez: esperaba **permiso para devolver la Lanza** — y llevaba trescientos años sin encontrar a quién.
3. **El error del norte.** Pero la espera carcomió. Un ala de la Orden — la que no olvidó, la que solo quedó — decidió acelerar: subió al Silencio a *despertar* el Segundo Canto a martillazos, cantándole notas humanas apresuradas. Y el Canto lento, despertado sin su hora, se torció: el mismo mal del Acto III, a escala de región. Esa ala es la semilla de los nuevos enemigos: los **Aprendices** (cantores de la Orden que la Niebla del sur reclutó por fin, con la letra ya aprendida) y su maestro.
4. **El jefe: LA TERCERA NOTA.** El antagonista final de la expansión no es un monstruo: es la segunda mitad del deicidio. Cuando la Lanza atravesó al dios, la herida hizo dos pedazos del Canto original: los siete Ecos que el mundo buscó... y **tres notas que nadie buscó**, las notas del final — la parte de la canción que el dios reservó para acabar el mundo cuando ya no quedara nada que sostener. Esas tres notas, torcidas por el despertar apresurado, se han hecho un cuerpo con lo que les dio la espera: máscara de Lanza, voz de Orden, hambre de Niebla. Se llama **La Tercera Nota** — subtítulo de banner: *«El final que cantó antes de tiempo»* — y pelea como pelea una canción de final: deshace el mundo de atrás hacia delante (sus ataques *deshacen*: te devuelven a la posición de hace dos segundos, te devuelven la vida que tenías antes de curarte, te hacen repetir el último ataque tuyo contra ti).
5. **El Segundo Canto.** Vencida la Tercera Nota, el jugador tiene en la mano la decisión final de la expansión — la simétrica de la del Acto III, pero con el tiempo por moneda: **tocar la Campana del Ayer** y dejar que el Segundo Canto despierte a su hora (el mundo del norte tardará lo que tarde; nadie verá el alba del Canto entero, pero nadie pagará nada) o **cantarle el Presto** — pagar el despertar con horas futuras del mundo (el norte florece ese mismo día... y el juego cobra: los NPC del norte envejecen, las cosechas adelantan, y una generación entera de Lunaris verá su mañana con retraso). No hay opción correcta: hay una decisión de carácter más, y los epílogos la reflejan en la costumbre de los mapas (los mapas del norte quedan con día de distinta hora según la elección).

### 14.4 Nuevas mecánicas del acto

- **El segundo Fragmento y el «aún».** El Fragmento de la Cuna desbloquea el tercer estado de época en la región nueva: el cambio Q alterna *presente ↔ aún*, y estrenar el presente estrena días (mundo vivo con fauna recién inventada, clima sin hábito, NPCs que dan los buenos días como si fueran del alba del mundo).
- **La pañoleta completa.** Con la marca de onda recuperada (la de la Memoria III), el jugador puede **cantar nombres** fuera de los faroles: una habilidad social nueva (tecla larga E sobre NPC del norte) que devuelve nombres pequeños — el perro de la esquina, la calle, el barco — y genera Presto, el recurso social del acto.
- **El Silencio y el combate sin nombre.** En el Silencio de Arriba, las habilidades nombradas quedan *sin nombre* tras usarse (no se pueden re-usar hasta que «se les vuelve la letra» tocando un hito de la zona): combate de recursos literal — has de pelear con lo que sabes hacer, no con lo que sabes llamar.
- **La Lanza devuelta.** La recompensa de la trama: la Orden entrega la **Lanza de los Durn** al jugador, que puede elegir dejarla clavada en la Cuna (bonus de facción con la Orden renovada + el logro *La Misericordia*) o — por una sola vez, en un punto de no retorno del final — usarla: el único ataque del juego capaz de herir *una nota* sin herir al que la canta. Es la herramienta del jugador para el duelo final sin matar a la Tercera Nota — con Lanza, la Tercera Nota no muere: **se calla**. Dos finales de jefe distintos, dos lore de epílogo distintos.

### 14.5 Los hilos que el acto cierra (y los que deja)

**Cierra:** Naia — la hermana de Ilwen está en la Ciudadela: se hizo cantora de la Orden y de tanto cantar los nombres de los Portadores caídos olvidó el suyo; el jugador la encuentra en la sala de los nombres y la escena usa el mismo catecismo de los faroles (*«se encienden con nombres dichos en voz alta»*). Nimue — la durmiente bajo las flores del Bosque es la original de la orden de cantoras de la Cuna: la Niebla no la hacía prisionera, la cuidaba *«como a una semilla»*, y con el Segundo Canto despierta como primera maestra del nuevo mundo. La madre del Portador — la cara que faltaba: vivió, era de la orden de Nimue, y su «cuando no recuerdes quién eres, acuérdate de lo que has hecho» era la instrucción que toda la orden deja a sus hijos por si el mundo se rompe: el Portador no era un elegido, era un **plan**. **Deja abierto:** qué pasa cuando el Segundo Canto termine de sonar (la puerta del Tercer Canto: *«la canción que se canta sola»* — la semilla de una tercera expansión o de un cierre definitivo), y el nombre que el mundo elegirá al final (Velmora o Aelthar o uno nuevo: el epílogo deja la placa del mundo en blanco para que la comunidad la discuta).
## 15. NUEVA PARTIDA+ (NG+): «EL CANTO RECORDADO»

### 15.1 El concepto: una partida que recuerda

La Nueva Partida+ de Ecos de Aelthar se llama internamente **El Canto Recordado**, y su premisa es la única que este mundo puede permitir: *en Aelthar, nada que se devolvió se olvida de verdad*. Al terminar el Acto IV (o el V, si la expansión está instalada), el juego ofrece empezar de nuevo llevándose **lo aprendido**, no lo conseguido: el Portador nuevo recuerda la melodía —no las coronas—. La sesión NG+ se marca en el guardado (`ecos-aelthar-save` gana el campo `canto: n`) y desbloquea un matiz en todos los textos: los NPC que te conocieron te reconocen — Brisa te saluda con tu nombre y con el de tus hazañas, Toln te llama «criador» en vez de «Portador», y Teo pregunta por la nana.

La regla de oro de diseño: **NG+ no es difícil; es melancólico por otro motivo**. El mundo vuelve a romperse y tú ya sabes lo que va a doler. El juego lo dice en su pantalla de inicio de NG+: *«Vas a volver a devolverlo todo. Esta vez sabrás lo que cuesta»*.

### 15.2 Qué se conserva y qué se devuelve

| Se conserva (los Ecos de Partida) | Se devuelve (vuelve a robarte la historia) |
|---|---|
| Las 7 Memorias (releíbles en el Diario con anotaciones NG+) | Todos los Ecos mayores y menores (hay que re-devolverlos) |
| El árbol de habilidades aprendido (nodos, no equipamiento) | Todas las flags de misión, cofres y faroles |
| Las herramientas de travesía (Campana, Brújula, Amuleto) | La Campana del Ayer (hay que volver a criarla: Toln la echa de menos) |
| El tono dominante y la afinidad de Ilwen | La reputación de las 4 facciones (a la mitad, redondeada abajo) |
| La orden táctica de la compañera | La compañera misma (Ilwen debe volver a confiar en ti: mismo reclutamiento) |
| Los récords de la Arena y logros | El oro, las armaduras y las mejoras de arma (a excepción del NG+1 del armario, ver 15.4) |

El reparto tiene lógica de mundo: se conserva lo que *vive en ti* (memoria, técnica, carácter) y se devuelve lo que *vive en el mundo* (objetos, nombres, deudas). Es la mecánica del juego hecha inventario.

### 15.3 Los Ecos de Partida (moneda de NG+)

Cada acto terminado y cada jefe aquietado otorgan **Ecos de Partida** (◆◆, distinctos de los ◆ del árbol), canjeables al crear la nueva partida en un nuevo menú del creador: *«Los Ecos que elegiste aguardan»*. Las mejoras disponibles (12, dos por hechizo temático del mundo):

- **Nana Tenaz** (1◆◆): la regeneración fuera de combate de Ilwen también cura al Portador — *«las canciones compartidas curan dos veces»*.
- **Cerilla de Mara** (1◆◆): la primera muerte de la partida no quita oro — *«una farera te enseña a no perder la esperanza por la noche»*.
- **Turno de Pastores** (2◆◆): +1 punto de atributo en cada nivel par — *«cantar por turnos rinde más que cantar a solas»*.
- **Marca de Onda** (2◆◆): los ataques cargados liberan la onda del pañoleta (pequeño empuje de área) — *«lo que tu madre cosió en ti sigue ahí»*.
- **Taza Llena** (2◆◆): las pociones curan +10% — *«alguien siempre deja una taza en el umbral»*.
- **Letra Aprendida** (3◆◆): los jefes muestran su barra de quiebre desde el primer golpe — *«ya conoces la canción: sabes dónde termina»*.
- **Permiso de Vuelta** (3◆◆): el faro de Mara está encendido desde el inicio (atajos de costa activos en el Acto I) — *«la costa tiene permiso para volver»*.
- **Lanza Guardada** (4◆◆, solo tras el Acto V): un golpe de Lanza sorda por partida, capaz de quebrar instantáneamente la barra de cualquier jefe — *«el silencio, usado con permiso»*.
- **Faro del Silencio** (4◆◆, solo tras el Acto V): en el Silencio de Arriba, tus habilidades conservan el nombre el doble de tiempo.
- **Semilla de Nimue** (5◆◆): un farol extra de Merrow te pide nombre y da un Eco menor adicional desde el primer acto.
- **Cristal Antiguo** (5◆◆): los santuarios revelan en el minimapa el objetivo de la misión actual de forma permanente.
- **El Eco que Elegiste** (6◆◆): tu tono dominante de la partida anterior da su bonificación desde el minuto uno y no se puede cambiar — *«ya sabes quién eres; ahora demuéstralo otra vez»*.

El coste total (38◆◆) supera deliberadamente lo ganable en una primera partida (24◆◆): el NG+3 es la partida del coleccionista, y cada iteración elige un carácter distinto.

### 15.4 El escalado y las diferencias de contenido

En NG+n, los enemigos escalan vida/daño ×(1 + 0,25·n) y los jefes añaden una **variación de guion** — no de números: el Guardián Hueco pregunta tu nombre (*«TÚ... OTRA VEZ... YA CONOZCO TU RESONANCIA...»*), la Sirena canta con la melodía que el jugador le devolvió, el Gólem *«cuenta también los pasos de tu partida anterior»* (sus ventiscas predicen un 15% mejor), y el Heraldo, si lo quebraste sin Lanza en la partida previa, empieza la pelea hablando: *«...me sigue gustando más descansar. Pero hay que cumplir»*. El contenido narrativo nuevo por anillo: **NG+1** añade tres conversaciones nuevas (Brisa y la taza de la partida anterior; Ilwen preguntando por Naia aunque no sepas aún dónde está; Velmora *«recordándote»* lo que aún no has hecho), desbloquea el **armario del Santuario** (guardar una armadura y un arma mejorada para el siguiente anillo) y añade un eco menor por mapa con lore metafísico (los «ecos del reloj»); **NG+2** añade la sala de los nombres de la Ciudadela precargada con los nombres de tus partidas anteriores; **NG+3** desbloquea el epílogo especial *«El Cronista»* — el único final donde el mundo se queda el nombre que el jugador escriba en la placa final.

### 15.5 El Santuario de NG+

Los santuarios ganan una tercera opción en NG+: *«Recordar el canto»* — un diario de partida anterior (actos, decisiones, la placa de reputaciones) leído en la misma vitral-eco de las Memorias. La primera vez que se usa, Brisa lo bautiza: *«Ahí guardamos los cantos que ya conocemos, para que el valle no tenga que aprenderlos dos veces. Descansa: el ayer nos espera y esta vez sabe tu nombre»*.

---

## 16. DESAFÍO 2.0: LA ARENA QUE CRECE

### 16.1 Herencia y mandato

El modo desafío actual (`challenge.ts`) ya tiene las columnas del templo: fotografía de campaña y restauración byte-idéntica, duelos 1v1 a una vida sin pociones, oleadas infinitas con escalado ×1,12, Centinela del Eco cada tres oleadas, récords en tres llaves y el principio fundacional del cartel: *«Los caídos no juzgan: cuentan»*. El Desafío 2.0 no lo reescribe: lo ** graduate**. Tres pilares: rangos de arena, los seis jefes del mundo en duelo, y las temporadas.

### 16.2 Rangos de la Arena

La Arena gana una progresión propia (clave `ecos-arena-rango`), con siete rangos que son escalones de una sola escalera narrativa — la del aedo:

| Rango | Nombre | Cómo se alcanza | Privilegio |
|---|---|---|---|
| 1 | **Oyente** | Primera oleada superada | Tabla de récords visible |
| 2 | **Cantor** | 5 oleadas o primer duelo | Elección de enemigos en oleadas (máx. 2 tipos por ronda) |
| 3 | **Rompejefes** | Primer duelo ganado | La cuenta atrás entre oleadas se puede saltar |
| 4 | **Interpuesto** | 10 oleadas | Regla especial: Ilwen aparece en la arena (fase oleadas), sin órdenes — *«allí nadie la manda, solo acompaña»* |
| 5 | **Aedo** | Duelo de Gólem ganado | El modificador de arena por racha (ver 16.3) |
| 6 | **Última Nota** | 15 oleadas o duelo con menos del 30% de vida | La arena respeta tu armadura favorita (el Portador de Arena hereda la armadura equipada) |
| 7 | **Campana** | Las siete pruebas del anillo (ver 16.4) | El epílogo de la arena: el Centinela del Eco te nombra por tu tono dominante |

Cada subida de rango suena: la Arena, que no tiene música propia (música 'boss'), incorpora por rango una capa percusiva nueva — *«la arena aprende tu ritmo»*—.

### 16.3 Rachas y modificadores honestos

Las oleadas ganan el sistema de **racha**: cada tercera oleada superada sin usar poción ofrece una carta de *modificador* a elegir entre dos (se anuncian con su poema antes de aplicarse): *«Marea»* (los enemigos entran desde el anillo en onda sincronizada: +20% oro de racha), *«Colmillo»* (aggro nocturno permanente: +1 racha extra), *«Eco»* (los enemigos mueren en dos muertes: la segunda paga doble XP), *«Silencio»* (sin señuelos ni pociones esta ronda: +2 rachas), *«Turno»* (curación del 15% convertida en escudo de la misma cantidad). La racha se pierde al usar poción o al caer y da su oro al retirarse por la puerta sur — el juego recuerda el contrato: *«La puerta del sur devuelve al valle con lo que trajiste»*.

### 16.4 Las siete pruebas del anillo (camino al rango Campana)

Una modalidad nueva de reto narrado, desbloqueable en rango 5: siete duelos encadenados con regla propia, uno por «nota»: 1) Guardián Hueco sin pociones; 2) Sirena Abisal sin salto; 3) Gólem de Escarcha con la ventisca permanente; 4) Vult, el Cazador de Ecos sin cambiar de época (en arena, el Silencio manda); 5) El Coro Roto sin romper máscaras (vencer solo con daño, sin quiebre); 6) El Guardián recordado a más de media vida sin recibir golpes melé; 7) El Heraldo · Vesh, la Última Nota con la regla inversa: **no puedes quebrar su barra** — hay que ganarle sin escuchar lo que canta debajo, o mejor dicho: se gana cuando aceptas oírlo la primera vez y entonces el duelo se vuelve la escena del Acto IV jugable a una vida. Completar el anillo otorga el rango Campana y el título jugable *«Campana del Eco»* en el HUD del desafío.

### 16.5 Duelos 2.0: los seis

Con la expansión instalada, el menú de duelos pasa de tres a seis: se añaden **Vult** (solo de noche, regla de MODO ACECHO cada 12 s fijos: *«no parpadees»*), **El Coro Roto** (las tres máscaras en orden, sin curación) y — tras el Acto V — **La Tercera Nota** en su versión de arena: la única pelea del juego donde el cronómetro corre *al revés* (el récord es el tiempo *largo*: cuanto más sobrevives al deshacer del mundo, más cuenta). Los récords existentes (`ecos-desafio-récords`, top 3 por desafío) se amplían con la clave `tercera_nota` y con el modificador de racha usado.

### 16.6 Temporadas (post-lanzamiento)

El ROADMAP ya contempla la rejugabilidad; el 2.0 la cierra con **temporadas de arena**: cada mes natural, una semilla global fija la mezcla de oleadas y un modificador de temporada (*«la temporada de la bruma», «la temporada del lago»*). Las tablas de récord ganan una columna de temporada y el cartel de la Arena se actualiza: *«Los caídos no juzgan: cuentan. Este mes, cuentan distinto»*. Sin servidores obligatorios: la semilla viaja en el parche y la tabla es local — el multijugador real queda para la capa del capítulo 19.
## 17. GREMIOS Y FACCIONES: LOS CUATRO COROS DE AELTHAR

### 17.1 Lo que ya existe

El juego ya tiene la arquitectura: cuatro facciones con reputación (clamp ±100), toasts de cambio (*«Guardianes del Canto: +5»*), la fuente antigua `repGuardianes` por misiones y Ecos, y la sección *«◆ VELMORA TE OBSERVA ◆»* en el menú de pausa, que muestra el tono dominante, las memorias y las cuatro reputaciones. Las facciones reales: **Guardianes del Canto** (la orden de Brisa: recordar en voz alta), **Orden de Vesh** (la Ciudadela: la guardia del silencio necesario), **Círculo Verde** (los de Doran: escuchar antes que combatir), **Liga de Mercaderes** (la de Vult: vender certezas). La ampliación las convierte en **gremios jugables**: no facciones que se eligen, sino *coros a los que se asiste* — el Portador puede cantar con todos, porque su oficio es precisamente no pertenecer a una sola voz.

### 17.2 Las rondas de reputación

La reputación ±100 se reorganiza en **rondas** (rango -100..-51 Disidente, -50..-1 Ajeno, 0..49 Simpatizante, 50..89 Cantante, 90..100 Voz). Cada ronda abre tienda, misión o privilegio propio; los umbrales están pensados para que una partida completa alcanza Cantante en dos facciones de corazón y Simpatizante en las otras dos — elegir Voz es una decisión de NG+.

### 17.3 Los cuatro gremios, ficha a ficha

**GUARDIANES DEL CANTO — «Nombrar es sostener».** Sede: la muralla de Lunaris y su escuela de campanas (nueva ala de la forja, donde la Campana del Ayer tiene su perchero). Rondas: *Simpatizante* — acceso al **coro del alba** (buff diario: +10% regeneración de aguante hasta el mediodía); *Cantante* — misiones de campanero (llamar la hora en mapas lejanos con la Campana portátil, mini-oleadas de Lobos a la vuelta) y el **Dielario de Nombres** (anota los nombres que devuelves; bonus de reputación con todos los gremios por cada diez); *Voz* — el privilegio del **tercer capellán**: las piedras cantan por ti (una vez por mapa, al caer a cero de vida, el mapa entero canta y te deja a 1 de vida en lugar de matarte — el logro *«Lo hacen las piedras»*). Su rama oscura: si eliges la verdad del Acto III, la Orden de Vesh te abre las rondas más rápido y los Guardianes dudan de ti — el sistema de gremios hereda la decisión del jugador.

**ORDEN DE VESH — «La lanza guarda el silencio necesario».** Sede: la Ciudadela (en la base actual: una antecámara en la Cripta, tras la puerta de la Guarda). Rondas: *Simpatizante* — las **cerillas de Vesh** (3 por mapa: apagar un combate temprano con un silencio de 3 s — *«inquirir es también pausar»*); *Cantante* — misiones de archivo (recuperar nombres de los Portadores caídos: cada uno da una habilidad de un Portador anterior durante un combate, *«los que subieron enseñan a quien sube»*) y el pergamino de la **Lanza muda** (+2% de daño contra jefes por verdad de la Orden revelada); *Voz* — la **última nota propia**: una vez por partida, transformar tu muerte en nota (todos los enemigos de la pantalla quedan sordos 10 s: no te ven — *«sonar sola, para nadie, tiene sus usos»*). Su conflicto: si callaste en el Acto III, la Orden te trata como uno de los suyos desde el minuto uno — el silencio también es membresía.

**CÍRCULO VERDE — «Lo que había antes del canto».** Sede: el claro de Doran y la raíz del Bosque. Rondas: *Simpatizante* — la **brújula viva** (la fauna te señala: las aves vuelan hacia los objetivos de misión cuando pasas cerca); *Cantante* — las **ofrendas de espina** (cultivar los jardines del pasado: plantar en el ayer flores que en el presente dan pociones — la única mecánica del juego donde el pasado produce para el presente, *«el suelo aún sabe doler: enséñale a dar fruto»*); *Voz* — la **escucha de la Madre Espina**: los árboles del Bosque dejan de tener silueta de terror para ti y dos veces por acto, la espina te guarda un golpe letal (espinazo de luz, recarga por descanso en santuario). Su doctrina en el sistema: el Círculo es el único gremio que da más por **no matar** — completar mapas sin bajas voluntarias (usar señuelos, esconderse, cambiar de época para desengancharse) acumula *gracia verde*, moneda de sus mejores rondas.

**LIGA DE MERCADERES — «Vendemos certezas».** Sede: el puesto de Vult en la Costa y — tras la Ronda de su redención — el **almacén de la colina**. Rondas: *Simpatizante* — el **libro de precios** (comparador de compras en cualquier tienda: *«la Liga no vende seda: vende certezas»*); *Cantante* — el **caravanero** (encargos de transporte entre mapas con carga frágil y emboscadas de la Niebla: la misión comercial del juego, con seguro opcional que Vult vende sin pudor); *Voz* — el **mapa con tu nombre en la leyenda**: un 10% de todo oro gastado te vuelve en descuentos de forja, y el privilegio real, *«facturar la escena»*: poder vender objetos con historia (los restos examinables de jefes sin botín, las cerillas usadas) a coleccionistas de la Liga — el juego convierte el lore en economía. Su límite moral, heredado del arco de Vult: si Vult murió a tu mano, la Liga no te abre la ronda de Cantante jamás — *«hay certezas que la Liga no compra»*.

### 17.4 Las misiones de gremio (estructura)

Todas las misiones de gremio siguen la misma liturgia de tres compases — **el encargo** (una necesidad concreta y con nombre: la campana de la escuela se desafina, el archivo pierde un nombre, la espina enferma, la caravana no llega) — **la letra** (resolverlo con el oficio del gremio: tocar, inquirir, escuchar o facturar) — **la ronda** (la recompensa paga reputación del gremio ±y reputación indirecta de los otros, porque en Aelthar todo lo que ayuda a un coro ayuda al coro entero: ±2/±1 en cruz). Seis misiones por gremio (24 en total), diseñadas para rejugarse con variaciones por tono dominante: el encargo cambia de letra si el Portador es sarcástico (*«la Liga aprecia a quien regatea con estilo»*) o amenazante (*«la Orden acepta a quien inquiere sin pedir permiso»*).

### 17.5 El consejo de los coros (endgame de facciones)

Con las cuatro rondas de Cantante alcanzadas, se desbloquea el **Consejo de los Coros** en Lunaris: una reunión mensual (in-game) donde los cuatro portavoces — Brisa, la Guarda (o su sucesora), Doran y el heredero de Vult — piden al Portador una mediación con dos verdades (el formato de la decisión del Acto III, elevado a estructura de endgame). Cada mediación resuelta añade una estrofa al **Canto de los Cuatro**, el conjunto de epílogos sociales del mundo: ocho decisiones después, el mapa del menú principal muestra las cuatro regiones teñidas según qué coro *suena* más fuerte en ellas. La biblia fija el estándar: **el endgame de facciones no premia al que eligió bien; premia al que hizo cantar juntas las voces que no cabían en la misma estrofa** — el Coro Roto, redimido, asiste en silencio y aplaude con campanas.

---

## 18. NUEVAS MECÁNICAS: EL HOGAR, LAS CRIATURAS Y EL COMERCIO

*(Base real: el ROADMAP MAESTRO reserva en su EPIC 8 «más mecánicas (escalada, combos de canciones, mascotas del Eco)» y la fauna ya declarada sin instanciar — gaviotas, cangrejos, gallinas, rapaces — espera asignación. Esta biblia diseña el conjunto.)*

### 18.1 El Hogar: la casa junto al río

La mecánica estrella de la ampliación es la que el juego ya lloró: la **casa del Memoria II**. En NG+ (o tras el Acto V), el jugador puede **reconstruir la casa junto al río**: un cobertizo del valle (el del cobertizo en ruinas, que el pasado recuerda entero) se restaura por fases — techo, puerta, sauce, segunda taza — con materiales y misiones de gremio. Al completarla, el Hogar da lo que da una casa: un lugar donde el tiempo no corre (la casa está en su propio «aún»: dentro, el ciclo de día no avanza — *«esta casa ya pagó sus días»*), un cofre de legado (transferencias NG+), la **taza siempre llena** (curación completa al despertar dentro, una vez por día) y el invite: cada NPC con reputación de Simpatizante o más puede ser invitado a vivir cerca — la aldea del jugador crece alrededor de su casa con las rutinas del mundo vivo (Toln abre su forja anexa al alba, Mara trae pecado fresco —perdón, pescado fresco—, Nera dicta nombres en el umbral).

El Hogar es también la respuesta mecánica al tema del juego: en un mundo donde la memoria es la moneda, **una casa es un recuerdo que se habita**. Su cartel, cuando se completa, es el único del juego que firma el jugador: *«Casa de [nombre del Portador]. La segunda taza sigue llena. La puerta, abierta»*.

### 18.2 Mascotas del Eco

Las **criaturas del Eco** son la línea de fauna declarada-but-not-instanced hecha sistema: con la pañoleta completa (cap. 14.4), el jugador puede cantar nombre a una criatura del mundo y adoptarla (máximo dos: *«el Eco no cría jaulas, cría compañía»*). Catálogo inicial, uno por bioma: la **gaviota de la costa** (te avisa de cofres que no has visto: *«vuela en círculos sobre lo que brilla»*), el **cangrejo de la orilla** (se entierra ante los enemigos y marca su posición con un chorro de arena: radar natural), la **gallina del hogar** (picotea y regala un huevo-día que cura 10 de vida; en el pasado, sus crías son un secreto del festival), la **rapaz de las cumbres** (planea en círculos altos y señala jefes vivos en el minimapa como el diamante rojo que ya dibuja), y la criatura secreta — el **pez del pozo de los nombres**: si el pozo del presente devuelve un día un reflejo con forma de pez (probabilidad determinista semanal), nombrarlo desbloquea la compañía más rara del juego, que nada en el aire a tu lado y *«no dice nada: escucha»*.

Las mascotas no combaten (la biblia lo prohíbe expresamente: en este mundo no se arma a la fauna — a los lobos los armó la Niebla y mira qué pasó) y su función es la que el juego llama **asistencia silenciosa**: te hacen el mundo legible sin hacértelo fácil.

### 18.3 La pesca de la Costa

El pez determinista ya existe (repositor sembrado con el reloj del mundo, saltos en arco con salpicadura y sonido); la pesca lo convierte en mecánica. Con la **caña de Mara** (recompensa de Cantante de la Liga o regalo de la farera tras la redención de Vult), el jugador puede pescar en cualquier tile de agua del mapa: el minijuego es de escucha, no de reflejos — la línea espera un *ritmo* (el del agua de ese mapa y hora: el río del Bosque canta distinto que el lago helado) y el jugador lo acompaña con la tecla de acción. Botín: peces-nombre (cada especie tiene nombre de la vieja nomenclatura del mar: la *sardina de bruma*, la *marea de tres notas*, el *silencio de fondo* — este último solo en la laguna de Merrow del presente, y no se puede comer: *«los silencios se devuelven»*), objetos perdidos del archivo del mar (boletos de barcos que se hundieron hace treinta años: al leerlos, el juego te cuenta a qué iban — códigos de color por destino: la Liga los compra como certezas, la Guarda los lee como duelo). La lectura de diseño: la pesca es la mecánica del **archivo** — el mar fue el primer archivo de Aelthar, y pescar es leerlo.

### 18.4 Combos de canciones (con la compañera)

El ROADMAP lo pide (*«combos de canciones»*) y el sistema de flechas elementales de Ilwen ya lo permite: la **armadía** — si el Portador aplica al mismo enemigo la debilidad elemental que la flecha de Ilwen está a punto de soltar (fuego→hielo→rayo, ciclo conocido), se dispara un **Canto a Dos** según el par: *VAPOR* (ya existe en el código: hielo sobre quemado, explosión de área 12) se une a *TEMPLAR* (rayo sobre hielo: el enemigo queda *afiado*, +25% daño recibido 4 s) y a *CRUJIDO* (fuego sobre rayo: la sombra del enemigo arde un instante y huye — aplica miedo mecánico a los no-jefes). Tercer nivel: encadenar los tres Cantos a Dos en el mismo enemigo dentro de 12 s desbloquea el **Canto Mayor a Dos** — la campana pequeña del HUD suena sola y el enemigo cae con un remate de luz sin importar su vida restante si es de menos del 15%. *«Cuando dos voces aciertan la misma nota, el mundo la escucha entera»*.

### 18.5 Escalada y travesía

La última pieza del ROADMAP: la **escalada** como lenguaje de travesía. Los acantilados de la Costa y la muralla de la Ciudadela ganan celdas de escalada (marcadas con la silueta de la onda): subir consume aguante por tramo, el viento de cada mapa empuja (la racha cuesta un tramo más: *«el aire corta los nombres y también las manos»*), y las caídas no matan: te dejan donde te ibas a dejar el ayer — con el oro intacto y la dignidad en deuda. Las celdas del norte abren los atajos que el juego ya insinuó (la Cumbre que mira a la Ciudadela). No hay pico que comprar: la técnica se aprende mirando a Ilwen (*«el pueblo del Bosque no escalaba: se dejaba subir»*) y se desbloquea con su afinidad a 40.

### 18.6 El carrusel del día (rutinas de NPC)

Con la ampliación, los NPC ganan rutinas horarias reales (el ROADMAP lo pide en su EPIC 7: *«NPCs con rutinas»*): Toln abre forja de 0,2 a 0,6 del ciclo y forja anexa en el Hogar si vive allí; Mara sube al faro al anochecer y baja al alba; Teo juega junto al pozo por la tarde y corre a casa antes de la noche (con la noche peligrosa del ROADMAP, su madre lo llama por su nombre — detalle que en Merrow todavía no es posible, y que cuando lo sea será la señal de que la aldea se curó); Ivo duerme la siesta en el refugio los días de ventisca; la Guarda camina la Cripta con su lanza al hombro las horas *«que las piedras no cantan»*. Las rutinas no son adorno: tres misiones de gremio dependen de encontrar a alguien *en su hora*, y el rumor del mundo las enseña: *«Cada quien tiene su compás. Si no está, no ha perdido el sitio: ha perdido la hora»*.
## 19. PLAN DE IMPLEMENTACIÓN Y MULTIJUGADOR

### 19.1 El suelo: el ROADMAP MAESTRO real

Esta ampliación no inventa su calendario: se apoya en el `docs/ROADMAP.md` real del repositorio (v1.0), que organiza el feedback del jugador en **8 épicas** — P0 bugs críticos, P1 game feel, P1 menús, P1 balance, P2 cielo/luz, P2 mapas, P3 contenido, P4 sistemas grandes — y un plan de **rondas 8–12** con agentes en paralelo y verificación por ronda (typecheck + build + juego con consola limpia → commit → merge a main → push). La regla del roadmap es la que esta biblia adopta: *nada de sistemas grandes (P4) hasta cerrar P0–P3*.

El estado de partida de la ampliación es bueno: los cuatro actos existen, el mundo vivo está en v4, la Arena funciona aislada, el guardado es tolerante a corrupción y hay smoke de auditoría (~200 checks en `smoke_qa17_sistemas.ts`) que sirve como red de seguridad para tocar sin miedo.

### 19.2 Las rondas propuestas de la ampliación (R13 en adelante)

| Ronda | Nombre | Contenido | Depende de |
|---|---|---|---|
| R13 | «La carta» | Acto V fase 1: la Cuna del Canto (mapa, Fragmento 2, estado *aún*), la carta, gancho y smokes de época ternaria | Rondas 8–12 cerradas; época ternaria compatible con `epochDiffs` |
| R14 | «La Ciudadela» | Acto V fase 2: Ciudadela (mapa grande, distritos con verdad que devolver), gremios fase 1 (rondas de reputación, tiendas y misión de cada coro) | R13; sistema de reputación existente |
| R15 | «El Silencio» | Acto V fase 3: Silencio de Arriba, combate sin nombre, jefe La Tercera Nota (IA de deshacer), Lanza devuelta, finales del acto | R14; quiebre existente |
| R16 | «El Canto Recordado» | NG+ completo: Ecos de Partida, escalado y guiones de jefe, armario del Santuario, ecos del reloj, epílogo Cronista | R15; guardado con campo `canto` |
| R17 | «La Arena que crece» | Desafío 2.0: rangos, rachas y modificadores, las siete pruebas, los seis duelos, temporadas por semilla | R16; challenge.ts existente |
| R18 | «Los cuatro coros» | Gremios fase 2: 24 misiones de gremio, gracia verde del Círculo, Consejo de los Coros, Canto de los Cuatro | R14 (gremios 1); tono dominante existente |
| R19 | «La casa» | Nuevas mecánicas 1: Hogar completo (fases, invitados, taza, cofre de legado), carrusel del día (rutinas NPC) | R16; worldlife existente |
| R20 | «Criaturas y archivo» | Nuevas mecánicas 2: mascotas del Eco (5 catálogo + secreta), pesca con caña de Mara, peces-nombre y objetos del archivo | R19; fauna declarada; pez determinista |
| R21 | «Dos voces» | Combos de canciones, escalada, celdas de travesía, atajos del norte | R20; ciclo elemental existente |
| R22 | «Segunda vez» | QA integral de la ampliación: smoke_qa_ampliación (~300 checks), balance de las nuevas zonas, revisión de textos, pase de logros nuevos (se proponen 8: *La Misericordia*, *Lo hacen las piedras*, *Campana del Eco*, *El Cronista*, *La segunda taza*, *Cartógrafo de lo vivo*, *El pozo devuelve*, *Tercera Nota aquietada*) | Todas |

Cada ronda hereda la liturgia probada del proyecto: agentes en paralelo con **exclusividad de archivos**, dominios vetados respetados (módulos `world/` y estética de sprites: agente visual), smokes con `bun`, verificación integral (tsc + smokes + rsync al árbol vivo + E2E), commit con resumen honesto, push y registro en el worklog con Task ID propio.

### 19.3 Multijugador: el análisis heredado y la decisión

El ROADMAP MAESTRO analizó las dos vías y esta biblia las ratifica con matices:

**Opción A — Coop online (2–4 jugadores), esfuerzo ALTO.** Requiere servidor Node con WebSocket, lógica de enemigos y daño como autoridad, predicción de cliente y serialización del estado (el motor ya separa `update.ts` de `render.ts`: la brecha es extraer el estado a snapshot serializable de 10–20 Hz con deltas). Las preguntas de diseño abiertas que el roadmap señala y la biblia contesta: la **época** sería por jugador (cada Portador teje su hora: el mapa muestra la mezcla y el mundo canta los cambios de los demás — es *el* argumento cooperativo de este mundo: dos jugadores viendo el mismo puente entero y roto a la vez); los **jefes** compartirían fase (el quiebre es colectivo: la barra baja con la suma); el **botín** sería personal y el progreso de campaña, del anfitrión con voto del resto. Presupuesto: 3–5 rondas (R23–R27) y hosting.

**Opción B — Coop local (2 mandos), esfuerzo MEDIO.** Gamepad API, HUD dividido, cámara compartida con zoom dinámico, sin servidor. Es el «¿cómo se siente?» antes de invertir en online.

**La decisión de esta biblia — «El Coop de la Arena» primero.** La tercera vía que ambas opciones sugieren y que este juego puede permitirse temprano: un coop de arena (modo desafío a 2 jugadores, online o local) sin tocar campaña. La Arena es *literalmente* el único mapa fuera del tiempo y fuera de flags: se puede sincronizar sin tocar ni una flag de historia, el guardado no arriesga la campaña (ya es no-op en reto), y las oleadas son la partida más sincronizable que existe (semilla compartida + input remoto). Es el caso más barato del multijugador y el más honesto con el lema de la Arena: *«los caídos no juzgan: cuentan»* — contar en compañía es el siguiente paso natural. Recomendación de calendario: **R23 como ronda corta** (coop de arena 1+1), evaluación, y solo entonces decidir si el coop completo merece R24–R28.

### 19.4 Riesgos y sus apuestas

- **Riesgo 1: la época ternaria rompe el motor.** Mitigación: el estado `aún` se implementa como tercer valor de `epoch` solo en los mapas nuevos con `epochDiffs` propios; los mapas viejos nunca lo reciben; los smokes de época ternaria se escriben en R13, no después.
- **Riesgo 2: la Ciudadela es un mapa grande y el motor está calibrado a mapas medianos.** Mitigación: mapa en distritos con carga por puerta (el patrón de fade ya existe) y spawns deterministas por distrito.
- **Riesgo 3: NG+ multiplica el estado guardado.** Mitigación: el campo `canto` del save versión 2 con migración idempotente (el smoke de carga ya audita campo a campo: se extiende, no se reescribe).
- **Riesgo 4: el tono.** La ampliación puede fallar por números y por *frases*. Mitigación de biblia: cada ronda nueva lleva su revisión de texto con el estándar de este documento (literales entre comillas, presagios antes de sustos, y el verbo devolver en el centro de cada mecánica).

---

## 20. GLOSARIO DE AELTHAR

**Aelthar.** El dios-tejedor cuyo canto sostenía el mundo; por metonimia, el mundo mismo. Murió de hambre —de ayer, no de comida— hace trescientos años, y aún no ha terminado de morir: su Segundo Canto respira bajo el norte. *«La voz de un dios no siempre dice la verdad»*.

**La Arena del Eco.** Recinto fuera del tiempo donde se pelea por números y no por historia. *«Los caídos no juzgan: cuentan»*.

**El ayer.** Un día ya vivido, arrancado y digerido en melodía por el Canto; la moneda con que el mundo pagaba su solidez. La Niebla come de lo mismo. Sin ayer, no hay mañana que esperar.

**La Campana del Ayer.** La campana que Toln crió con el metal que recuerda; reparte las horas, llama al coro de antes y da nombre al valle. Abrió la Sala del Primer Canto. En NG+, hay que volver a criarla.

**Canto (el).** La melodía del dios que sostenía el mundo; quebrada en siete Ecos por la Lanza. Su canto al revés no es una canción: es una puerta abierta del otro lado.

**El Canto Recordado.** El nombre interno de la Nueva Partida+: volver a devolverlo todo, sabiendo lo que cuesta.

**La Ciudadela.** Sede de la Orden de Vesh; el lugar donde tu nombre ya está escrito, junto al de todos los que subieron. Ningún Portador volvió de ella. Hasta ahora.

**El Coro Roto.** Tres máscaras cosidas con la nota del revés (El Pulso, El Vera, El Silencio); jefe opcional de la Cripta. Redimido: tres campanas gemelas aprendiendo a sonar juntas.

**Los Durn.** Los herreros sordos que forjaron la Lanza Muda. Su obra sigue silbando, esperando la segunda vez.

**Eco (los siete Ecos).** Los pedazos mayores del Canto: la Voz, las Mareas, las Cumbres... y cuatro por reunir. Los hay menores nacidos del propio mundo: el Eco de los Nombres, los dieciocho ecos de los mapas.

**Eco de Partida.** La moneda de NG+: lo aprendido que sobrevive al olvido del mundo.

**Festival del Canto / Festival del Nombre.** Las dos fiestas perdidas del pasado: la de Lunaris (flores, campanas, pan) y la de Merrow (nombrar a los hijos en voz alta al alba). En el juego, se visitan con Q.

**El Heraldo · Vesh, la Última Nota.** El hombre que creyó que ser la última nota era un honor y resultó ser un castigo: *«sonar sola, para nadie»*. Jefe final del Acto IV. Golpea como un silencio que cae.

**Ilwen.** Arquera del pueblo perdido del Bosque; busca a su hermana Naia; te cubre la espalda y, cuando hace falta, se interpone. *«Cuando hables como alguien con quien caminar, aquí estaré»*.

**La Lanza de los Durn (La Lanza Muda).** La única lanza sorda de nacimiento; atravesó el costado del dios y le enseñó al silencio que se puede. Espera la segunda vez. Devolverla es la misericordia; usarla, la excepción.

**Merrow.** La aldea a la que la Niebla borró el nombre verdadero. *«Como quien roba un pañuelo y deja la mano fría»*. Su farol se enciende con nombres dichos en voz alta.

**La Niebla Muda.** El silencio que entró por la herida del dios. No roba el Canto: lo aprende, nota a nota, al revés. Come nombres, días y caras. Sus criados son cantores rotos.

**Nimue.** El nombre que duerme bajo las flores del Bosque, cuidada por la Niebla *«como a una semilla»*. Ilwen jura que su hermana no se llamaba así. Las dos cosas son verdad.

**El pozo de los nombres.** El pozo de Lunaris donde se susurraban los nombres para que el dios los tejiera en su canto. En el presente devuelve silencio; en el ayer, teje.

**El Portador.** Quien puede oír los Ecos. Oficio de hambre y de despedida: los anteriores no volvieron de la Ciudadela. Su ética entera cabe en una frase: *«acuérdate de lo que has hecho»*.

**El Presto.** (Ampliación) El tiempo todavía no vivido, usado como moneda prohibida: pagar el mañana por adelantado. Lo contrario del ayer. El juego enseña a no usarlo.

**El Quiebre.** La barra de los jefes: golpes continuos la vacían, el enemigo queda vulnerable y rematable. En este mundo, quebrar es escuchar: la Guarda lo enseña antes del jefe final — *«rompe su barra... y escucha lo que canta debajo»*.

**Resonancia.** La parte del Canto que vibra en cada cosa viva; el recurso mágico del juego. Se gana con golpes y muertes, se gasta en Cantos. Todo lo que existe resuena.

**Santuario del Eco.** Cristal donde se descansa, se guarda el canto y se viaja. *«Descansas junto al cristal. Partida guardada. Vida restaurada»*.

**La Tercera Nota.** (Ampliación) Las notas del final que el dios reservó para acabar el mundo; torcidas por un despertar apresurado. El final que cantó antes de tiempo.

**Tono.** La forma de hablar del Portador: empático, pragmático, sarcástico o amenazante. El mundo la escucha y te trata en consecuencia: en Aelthar, el carácter es una estadística.

**Velmora.** La Primera Portadora: la primera nota del Canto se pagó con su ayer. Su nombre era también el nombre antiguo del mundo. Tiende su ayer *«como quien tiende una taza»*.

**Vesh.** El Gran Inquisidor que vio el hambre del dios y decidió la amputación. No era cruel: era un hombre que vio. *«Dos verdades caben en una noche: fue un asesinato... y fue un regalo»*.
## 21. APÉNDICE: DATOS DE DISEÑO Y NOTAS DE CANON

*Todas las cifras de este apéndice son literales del código (v0.5.x). Sirven como referencia rápida de balance para la ampliación y como acta notarial del estado del mundo.*

### 21.1 Jefes de campaña

| Jefe | HP | DMG | Quiebre | XP | Oro | Debilidad | Arena |
|---|---|---|---|---|---|---|---|
| El Guardián Hueco — *Custodio del Eco de la Voz* | 345 | 14 | 80 | 220 | 120–160 | sagrado/luz | Cripta (arena 10,12) |
| La Sirena Abisal — *La que olvidó su nombre* | 440 | 15 | 105 | 240 | 130–170 | rayo | Costa (naufragio 39,24) |
| El Gólem de Escarcha — *Memoria de la montaña* | 535 | 19 | 126 | 280 | 150–200 | fuego | Cumbres (paso al altar 24,8) |
| Vult, el Cazador de Ecos — *(opcional)* | 420 | 14 | 95 | 260 | 140–180 | sagrado | Cumbres, solo de noche, questIdx ≥ 11 |
| El Coro Roto — *Tres máscaras, una nota al revés* *(opcional)* | 520 | 13 | 110 | 320 | 160–220 | sagrado | Cripta, junto al altar libre (post-Acto III) |
| El Guardián recordado — *(élite del Acto III)* | — | — | — | — | — | sagrado | Cripta, fuera del tiempo (`acto3_subir`) |
| El Heraldo · Vesh, la Última Nota — *(jefe final)* | 640 | 20 | 130 | 420 | 220–280 | sagrado | La Sala del Primer Canto |

### 21.2 Enemigos comunes

| Enemigo | HP | DMG | Velocidad | Oro | Debilidad | Notas de comportamiento |
|---|---|---|---|---|---|---|
| Lobo de Niebla | 30 | 6 | 58 | 4–8 | fuego | Estampidas; aggro nocturno ×1,3; herido puede huir |
| Esqueleto Cantor | 46 | 10 | 44 | 7–12 | sagrado | Peregrino vaciado; marca compás con su fémula |
| Sombra sin Rostro | 30 | 8 | 66 | 3–6 | sagrado | Devora nombres; invocada por el Guardián y la arena |
| Neumo de Marea | 30 | 8 | 42 | 6–10 | rayo | Tirador esquivo (banda 90–130 px); agónico en abanico |
| Espectro sin Nombre | 40 | 10 | 52 | 7–12 | luz | Se desvanece al primer golpe; solo en el presente de Merrow |
| Arpía de Cumbre | 32 | 9 | 76 | 6–10 | fuego | Órbita y picado sincronizado en pandilla |
| Eco Desgarrado | 55 | 11 | 84 | — | luz | Parpadea a tu flanco (alternante, con telegrafía de bruma) |
| Sátiro de la Niebla | 44 | 9 | 62 | — | fuego | Orbe en parábola sobre tu posición predicha; huye silbando |
| Centinela del Eco | — | — | — | — | sagrado | Mini-jefe de arena cada 3 oleadas, 25% más blando |

### 21.3 Armaduras de la forja de Toln

| Tier | Nombre | Precio | Reducción | Extra |
|---|---|---|---|---|
| 1 | Coraza de Cuero | 80 | 8% | — |
| 2 | Malla del Alba | 160 | 15% | +10 vigor/s |
| 3 | Placas del Canto | 240 | 22% | −8% de velocidad |
| 4 | Manto de Ecos | 280 | 12% | refleja 15% del daño melé |
| 5 | Guarda del Primer Canto | 420 | 28% | única; requiere `acto3Done` |

### 21.4 Economía (coronas)

- **Ingresos**: misiones (q2: 50 · q6: 20 · q7: 40 · q8: 35 · q9: 50 · q10: 60 · q11: 60 · q12: 80 · q13: 100 · q14: 80 · q15: 120 · q16: 150), botines de enemigos (tabla 21.2), restos examinables (25% de 1–5, una vez por cadáver, TTL 30 s), cofres, botines únicos de jefes (Sirena +1 poción · Gólem +30 · Vult +40 y poción · Coro +60 y poción · Vesh +80 y poción), y +20% con *Ojo del Mercader*.
- **Gastos**: poción 15 (cura 40% de vida) · mejora de arma `30 + 25·nivel` (tope +5) · señuelo de caza 60 · armaduras 80/160/240/280/420.
- **Curva de referencia del diseño**: el Acto I deja ~200–250 coronas y el Acto II ~1100 — la escalera de armaduras es un sumidero escalonado a propósito.
- **Muerte**: pierdes la mitad del oro, recuperable en el lugar de la caída (`deadGolds`). *«Un eco de tu oro sigue donde caíste...»*.
- **Nivel/XP**: `xpNext = round(36 · nivel^1.45)`; +7 vida máx. por nivel, +3 puntos de atributo. Atributos: Fuerza (+1,5 daño melé/punto), Destreza (+2% crítico, +2 resistencia), Intelecto (+1,6 daño de Cantos), Espíritu (+10% ganancia de Resonancia), Vigor (+7 vida, +1% reducción, tope 50%).

### 21.5 Balanceador dinámico

| Nivel | Vida enemiga | Daño enemigo | XP |
|---|---|---|---|
| −2 Muy fácil | 0,75 | 0,80 | 0,85 |
| −1 Fácil | 0,88 | 0,90 | 0,93 |
| 0 Normal | 1,00 | 1,00 | 1,00 |
| +1 Difícil | 1,15 | 1,10 | 1,08 |
| +2 Muy difícil | 1,30 | 1,20 | 1,15 |

Voto por ventana de 10 s (muertes, pociones, daño recibido, flawless), cambio ±1 solo con dos ventanas consecutivas, histéresis, toasts tras 300 s, neutro en la Arena. Referencias de nivel por zona: lunaris 2 · bosque 4 · cripta 5 · costa 8 · aldea 9 · cumbres 11.

### 21.6 Logros (12) y estadísticas (10)

**Logros:** Primer Canto · Cazador de Ecos (5 ecos menores) · Rompejefes (3 jefes) · Corazón de Alba (Acto I) · Notas Perdidas (Acto II) · Canto al Revés (Acto III) · El Último Canto (Acto IV) · Invicto (nivel 5 sin morir) · Rico (500 coronas) · Alquimista (10 pociones) · Viajero del Tiempo (10 cambios de época) · Rondador (desafío ganado con >70% de vida).

**Estadísticas:** enemigosDerrotados · jefesDerrotados · muertes · coronasGanadas · coronasGastadas · pocionesUsadas · vecesCambioEpoca · distanciaAndada · tiempoJugado · memoriasHalladas. (La Arena no contamina la campaña: guard `challengeRun`.)

### 21.7 Claves de guardado (localStorage)

`ecos-aelthar-save` (partida completa v1) · `ecos-stats` · `ecos-logros` · `ecos-desafio-récords` (top 3 de tiempos) · `ecos-desafio-best` · `ecos-desafio-logros` (duelos ganados) · `ecos-balance` · `ecos-arbol` (árbol por `nombre|disciplina`) · `ecos-vol` (volúmenes) · `aelthar_perf` (rendimiento). Lecturas tolerantes con defaults ante JSON corrupto.

### 21.8 El árbol de habilidades (31 ◆ totales, 13 alcanzables a Nv 12)

**VÍA DEL FILO** (#f0a050): Filo Templado (+10% melé) · Corazón de Roble (+20 vida) · Eco del Filo (eco retardado al 35%) · Refrán Veloz (−20% cds) · Onda Sísmica · Lanza del Alba (perfora 4) · Cólera del Alba (+15% melé). **VÍA DEL ECO** (#5ad0e8): Afinación (+1,5 Res/s) · Aliento Cálido (+40% regen. aguante) · Cadencia Arcana (−20% cds) · Nova de Escarcha · Tormenta Encadenada (5 rayos) · Aureola de Ceniza · Mente de Cristal (+20% hechizos). **VÍA DEL CAMINO** (#8ef0b0): Paso de Brisa (+12% velocidad) · Ojo del Mercader (+20% oro) · Bendición del Camino (escudo 25% vida) · Campana del Retorno (tecla 5) · Brújula de Ecos (tecla 6) · Amuleto de Aelthar (tecla 7). Curva de puntos: 1/nivel desde el 2 + extras en Nv 5 y 10 — *«aprenderlo TODO es imposible»*.

### 21.9 Notas de canon

1. **Aelthar / Velmora.** Dos nombres para el mundo (el dios y la era anterior). Canon de esta biblia (cap. 1.7): el mundo se llamó Velmora antes del Canto; la Primera Portadora llevaba el nombre de su mundo. El epílogo del Acto V deja la placa del nombre en blanco.
2. **La cuenta de q9.** La misión q9 se titula «La Cumbre del Segundo Canto» pero su Eco es el tercero, y su propio diálogo lo llama «el tercer canto». Canon: **el mundo cuenta mal lo que le falta** — la Niebla borró también la aritmética; Brisa cuenta con los dedos de su mano izquierda, donde falta uno. (La ampliación puede usar esta cuenta rota como pista: los Guardianes sabían que había más Ecos de los que la Orden dejó por escrito.)
3. **Las 60 frases de rumor y los 18 ecos menores** son canon completo; cualquier texto nuevo de la ampliación debe pasar por el mismo tamiz de tono (corte seco, duelo con nombre, ninguna explicación de más).
4. **Fauna declarada sin instanciar** (gaviota, cangrejo, gallina, rapaz): canon de diseño pendiente de implementación; la ampliación las adopta como mascotas (cap. 18.2).
5. **El Acto IV existe antes que el roadmap.** El ROADMAP MAESTRO (v1.0) data de antes del Acto IV y lo trata como futuro; esta biblia prevalece como fuente de canon narrativo cuando contradiga al roadmap en materia de historia.
6. **La Niebla no muere.** Nada del juego ni de esta biblia mata a la Niebla: se le devuelven cosas, se le enseñan límites, se le da descanso. Cualquier contenido futuro que «elimine la Niebla para siempre» viola el canon: el silencio es la forma natural del mundo — lo que este mundo cura es el hambre, no el silencio.
