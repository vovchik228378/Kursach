document.addEventListener('DOMContentLoaded', function() {
    ymaps.ready(init);

    let myMap;
    let markers = [];
    let markerCounter = 1;

    function init() {
        myMap = new ymaps.Map("map", {
            center: [55.76, 37.64],
            zoom: 10
        });

        loadMarkersFromServer();

        document.getElementById('addMarker').addEventListener('click', function() {
            let coords = myMap.getCenter();
            let hint = 'Моя метка ' + markerCounter;
            addMarkerToServer(coords, hint);
        });

        document.getElementById('removeMarker').addEventListener('click', function() {
            let select = document.getElementById('markerList');
            let selectedIndex = select.selectedIndex - 1;

            if (selectedIndex >= 0 && selectedIndex < markers.length) {
                removeMarkerFromServer(markers[selectedIndex].id);
            }
        });
    }

    async function loadMarkersFromServer() {
        try {
            const response = await fetch('http://localhost:5000/api/markers/my', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            markers = data;
            updateMarkerList();
            refreshMapMarkers();
        } catch (error) {
            console.error('Ошибка:', error);
        }
    }

    async function addMarkerToServer(coords, hint) {
        try {
            const response = await fetch('http://localhost:5000/api/markers/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ lat: coords[0], lng: coords[1], hint })
            });
            const data = await response.json();
            if (response.ok) {
                loadMarkersFromServer();
            }
        } catch (error) {
            console.error('Ошибка:', error);
        }
    }

    async function removeMarkerFromServer(markerId) {
        try {
            const response = await fetch(`http://localhost:5000/api/markers/delete/${markerId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            const data = await response.json();
            if (response.ok) {
                loadMarkersFromServer();
            }
        } catch (error) {
            console.error('Ошибка:', error);
        }
    }

    function updateMarkerList() {
        let select = document.getElementById('markerList');
        select.innerHTML = '<option value="">Выберите метку для удаления</option>';
        markers.forEach((marker, index) => {
            let option = document.createElement('option');
            option.value = index;
            option.text = marker.hint;
            select.appendChild(option);
        });
    }

    function refreshMapMarkers() {
        myMap.geoObjects.removeAll();
        markers.forEach(markerData => {
            let placemark = new ymaps.Placemark([markerData.lat, markerData.lng], {
                hintContent: markerData.hint
            });
            myMap.geoObjects.add(placemark);
        });
    }
});