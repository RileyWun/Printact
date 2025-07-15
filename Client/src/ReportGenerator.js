// client/src/ReportGenerator.js
import React from 'react';
import jsPDF from 'jspdf';
import { Card, CardContent, Typography, Button } from '@mui/material';

const ReportGenerator = ({ projects }) => {

    const generatePdf = () => {
        if (!projects || projects.length === 0) {
            alert('No project data available to generate a report.');
            return;
        }

        const doc = new jsPDF();
        const overallTotal = projects.reduce((sum, p) => sum + p.totalCO2e, 0);

        doc.setFontSize(20);
        doc.text("CO2e Emissions Report", 105, 20, null, null, "center");
        doc.setFontSize(12);
        doc.text(`Report Generated: ${new Date().toLocaleDateString()}`, 105, 30, null, null, "center");
        doc.text(`Total CO2e Across All Projects: ${overallTotal.toFixed(2)} kg`, 15, 45);

        let yPos = 60;
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text("Job ID", 15, yPos);
        doc.text("Project Name", 50, yPos);
        doc.text("Total CO2e (kg)", 170, yPos);
        doc.setFont(undefined, 'normal');
        yPos += 7;

        projects.forEach(p => {
            if (yPos > 280) {
                doc.addPage();
                yPos = 20;
            }
            doc.text(p.job_id, 15, yPos);
            doc.text(p.name, 50, yPos);
            doc.text(p.totalCO2e.toFixed(2), 170, yPos);
            yPos += 7;
        });

        doc.save(`CO2e_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    };

    return (
        <Card>
            <CardContent>
                <Typography variant="h6" gutterBottom>Generate Report</Typography>
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                    Create a PDF summary of the currently filtered projects.
                </Typography>
                <Button variant="contained" onClick={generatePdf} fullWidth>
                    Download PDF Report
                </Button>
            </CardContent>
        </Card>
    );
};

export default ReportGenerator;
