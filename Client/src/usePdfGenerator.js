import { useState } from 'react';
import axios from 'axios';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import html2canvas from 'html2canvas';

const usePdfGenerator = (filters, chartTotalCo2e, chartRef, pieChartRef) => {
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);

    const handleGenerateReport = async () => {
        setIsGeneratingReport(true);
        const queryString = new URLSearchParams(Object.fromEntries(Object.entries(filters).filter(([_, v]) => v != null && v !== ''))).toString();

        try {
            // Step 1: Fetch all data needed for the report
            const [clientInfoRes, storeBreakdownRes, componentBreakdownRes] = await Promise.all([
                axios.get('http://localhost:5001/api/users/me'),
                axios.get(`http://localhost:5001/api/reports/store-breakdown?${queryString}`),
                axios.get(`http://localhost:5001/api/reports/component-breakdown?${queryString}`)
            ]);
            
            const clientName = clientInfoRes.data.clientName;
            const doc = new jsPDF('p', 'mm', 'a4');
            const padding = 15;
            const pageWidth = doc.internal.pageSize.getWidth();
            const contentWidth = pageWidth - (padding * 2);

            // --- PAGE 1 ---
            doc.setFontSize(22);
            doc.text('CO2e Emissions Report', pageWidth / 2, 20, { align: 'center' });
            
            const appliedFilters = Object.entries(filters).map(([key, value]) => {
                if(key === 'dateRange' && (value.start || value.end)) return `Date (${value.start || '...'} to ${value.end || '...'})`;
                if(key === 'projectName' && value) return `Project (${value})`;
                if(key === 'state' && value) return `State (${value})`;
                if(key === 'storeName' && value) return `Store (${value.name})`;
                return null;
            }).filter(Boolean);

            doc.setFontSize(11);
            doc.text(`Client: ${clientName}`, padding, 35);
            doc.text(`Filters: ${appliedFilters.length > 0 ? appliedFilters.join(' | ') : 'None'}`, padding, 42);
            doc.setFontSize(14);
            doc.text(`Total CO2e: ${chartTotalCo2e.toFixed(2)} kg`, pageWidth - padding, 35, { align: 'right' });
            
            const barCanvas = await html2canvas(chartRef.current.canvas, { scale: 2 });
            const barImgData = barCanvas.toDataURL('image/png', 1.0);
            const barHeight = (barCanvas.height * contentWidth) / barCanvas.width;
            doc.addImage(barImgData, 'PNG', padding, 55, contentWidth, barHeight);

            // --- PAGE 2 ---
            doc.addPage();
            doc.setFontSize(18);
            doc.text('Emission Components Breakdown', pageWidth / 2, 20, { align: 'center' });
            const pieCanvas = await html2canvas(pieChartRef.current, { scale: 2 });
            const pieImgData = pieCanvas.toDataURL('image/png', 1.0);
            const pieHeight = (pieCanvas.height * contentWidth) / pieCanvas.width;
            doc.addImage(pieImgData, 'PNG', padding, 30, contentWidth, pieHeight);
            
            autoTable(doc, {
                startY: 30 + pieHeight + 5,
                head: [['Component', 'Total CO2e (kg)']],
                body: componentBreakdownRes.data.map(c => [c.component, parseFloat(c.total_emissions).toFixed(2)]),
            });

            // --- PAGE 3 ---
            doc.addPage();
            doc.setFontSize(18);
            doc.text('Emissions by Store', padding, 20);
            autoTable(doc, {
                startY: 25,
                head: [['Store', 'State', 'Total CO2e (kg)']],
                body: storeBreakdownRes.data.map(s => [s.store_name, s.state_name, parseFloat(s.total_emissions).toFixed(2)]),
            });

            // --- PAGE 4 ---
            doc.addPage();
            doc.setFontSize(18);
            doc.text('Calculation Methodology', padding, 20);
            const methodologyText = `CO2e (Carbon Dioxide Equivalent) is a standard unit for measuring carbon footprints...`; // Your methodology text here
            doc.setFontSize(10);
            doc.text(doc.splitTextToSize(methodologyText, contentWidth), padding, 30);

            doc.save(`CO2e_Report_${new Date().toISOString().slice(0,10)}.pdf`);
        } catch (error) {
            console.error("Error generating PDF:", error);
            alert("Could not generate PDF. See console for details.");
        } finally {
            setIsGeneratingReport(false);
        }
    };

    return { isGeneratingReport, handleGenerateReport };
};

export default usePdfGenerator;
