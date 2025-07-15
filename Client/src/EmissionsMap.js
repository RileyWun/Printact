// client/src/EmissionsMap.js
import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Box, Typography } from '@mui/material';

const EmissionsMap = ({ stores }) => {
    // If stores are filtered, center the map on the first result.
    // Otherwise, use a default location.
    const mapCenter = stores && stores.length > 0
        ? [stores[0].lat, stores[0].lng]
        : [-37.8136, 144.9631];

    const zoomLevel = stores && stores.length === 1 ? 13 : 6; // Zoom in if only one store is shown

    return (
        <Box sx={{ height: 'calc(100% - 30px)', width: '100%' }}>
            {/* The key prop forces the map to re-render when its center changes */}
            <MapContainer key={mapCenter.toString()} center={mapCenter} zoom={zoomLevel} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                {stores && stores.map(store => (
                    store.lat && store.lng && (
                        <Marker key={store.id} position={[store.lat, store.lng]}>
                            <Popup>
                                <Typography variant="subtitle2">{store.name}</Typography>
                                {/* Display the CO2e data from the API */}
                                <Typography variant="body2">
                                    CO2e: {parseFloat(store.total_emissions).toFixed(2)} kg
                                </Typography>
                            </Popup>
                        </Marker>
                    )
                ))}
            </MapContainer>
        </Box>
    );
};

export default EmissionsMap;