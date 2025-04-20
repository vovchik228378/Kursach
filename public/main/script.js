// Инициализация Supabase
const supabase = supabase.createClient(
    'https://mxdddbkfyugyyzabfqor.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14ZGRkYmtmeXVneXl6YWJmcW9yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDUwOTY3NzMsImV4cCI6MjA2MDY3Mjc3M30.zNoJad5-R0mTP95yz-2_0j-Lj6-eNy4S89ciQ7BZWmQ'
)

let map
const markers = []

// Инициализация карты
function initMap() {
    ymaps.ready(async() => {
        try {
            // Создаем карту
            map = new ymaps.Map("map", {
                center: [55.76, 37.64],
                zoom: 10,
                controls: ['zoomControl', 'typeSelector', 'fullscreenControl']
            })

            // Проверяем авторизацию
            const { data: { session }, error: authError } = await supabase.auth.getSession()
            if (authError || !session) {
                window.location.href = '/login/login.html'
                return
            }

            // Загружаем метки
            await loadMarkers()

            // Подписываемся на изменения в реальном времени
            setupRealtimeUpdates()

        } catch (error) {
            console.error('Ошибка инициализации карты:', error)
            alert('Произошла ошибка при загрузке карты')
        }
    })
}

// Загрузка меток из базы данных
async function loadMarkers() {
    try {
        const { data: markersData, error } = await supabase
            .from('markers')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) throw error

        // Очищаем старые метки
        map.geoObjects.removeAll()
        markers.length = 0

        // Добавляем новые метки
        markersData.forEach(marker => {
            addMarkerToMap(marker)
        })

        // Автоматическое масштабирование под все метки
        if (markersData.length > 0) {
            const bounds = map.geoObjects.getBounds()
            if (bounds) {
                map.setBounds(bounds, { checkZoomRange: true })
            }
        }

    } catch (error) {
        console.error('Ошибка загрузки меток:', error)
        alert('Не удалось загрузить метки')
    }
}

// Настройка обновлений в реальном времени
function setupRealtimeUpdates() {
    const channel = supabase
        .channel('markers_changes')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'markers'
        }, async(payload) => {
            if (payload.eventType === 'INSERT') {
                addMarkerToMap(payload.new)
            } else if (payload.eventType === 'DELETE') {
                removeMarkerFromMap(payload.old.id)
            }
        })
        .subscribe()
}

// Добавление метки на карту
function addMarkerToMap(marker) {
    const placemark = new ymaps.Placemark(
        [marker.lat, marker.lng], {
            balloonContentHeader: `<strong>${marker.name}</strong> ${marker.emoji || ''}`,
            balloonContentBody: marker.description || '',
            balloonContentFooter: `Добавил: ${marker.username || 'Аноним'}`,
            hintContent: marker.name
        }, {
            preset: marker.emoji ? 'islands#' + marker.emoji + 'CircleIcon' : 'islands#blueCircleIcon',
            balloonCloseButton: true,
            hideIconOnBalloonOpen: false
        }
    )

    map.geoObjects.add(placemark)
    markers.push({ id: marker.id, placemark })
}

// Удаление метки с карты
function removeMarkerFromMap(markerId) {
    const markerIndex = markers.findIndex(m => m.id === markerId)
    if (markerIndex !== -1) {
        map.geoObjects.remove(markers[markerIndex].placemark)
        markers.splice(markerIndex, 1)
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', initMap)