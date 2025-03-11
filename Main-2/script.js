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

        document.getElementById('addMarker').addEventListener('click', function() {
            var coords = myMap.getCenter();
            var marker = new ymaps.Placemark(coords, {
                hintContent: 'Метка ' + markerCounter
            });
            myMap.geoObjects.add(marker);
            markers.push(marker);
            updateMarkerList();
            markerCounter++;
        });

        document.getElementById('removeMarker').addEventListener('click', function() {
            var select = document.getElementById('markerList');
            var selectedIndex = select.selectedIndex - 1;
            if (selectedIndex >= 0 && selectedIndex < markers.length) {
                myMap.geoObjects.remove(markers[selectedIndex]);
                markers.splice(selectedIndex, 1);
                updateMarkerList();
            }
        });

        function updateMarkerList() {
            var select = document.getElementById('markerList');
            select.innerHTML = '<option value="">Выберите метку для удаления</option>';
            markers.forEach((marker, index) => {
                var option = document.createElement('option');
                option.value = index;
                option.text = 'Метка ' + (index + 1);
                select.appendChild(option);
            });
        }
    }
});