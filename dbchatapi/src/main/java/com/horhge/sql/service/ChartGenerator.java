package com.horhge.sql.service;

import org.jfree.chart.ChartFactory;
import org.jfree.chart.JFreeChart;
import org.jfree.chart.ChartUtils;
import org.jfree.data.category.DefaultCategoryDataset;
import org.jfree.data.general.DefaultPieDataset;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.Base64;
import java.util.List;

public class ChartGenerator {
    public static String generateChart(List<List<Object>> rowData, String chartType) throws Exception {
        if (rowData == null || rowData.size() < 2) throw new IllegalArgumentException("Not enough data for chart");
        List<Object> headers = rowData.get(0);
        if (headers.size() < 2) throw new IllegalArgumentException("Need at least 2 columns for chart");
        JFreeChart chart;
        if (chartType == null) chartType = "bar";
        chart = switch (chartType.toLowerCase()) {
            case "pie", "pie chart" -> createPieChart(rowData, headers);
            case "line", "line chart" -> createLineChart(rowData, headers);
            default -> createBarChart(rowData, headers);
        };
        BufferedImage image = chart.createBufferedImage(700, 400);
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ChartUtils.writeBufferedImageAsPNG(baos, image);
        return Base64.getEncoder().encodeToString(baos.toByteArray());
    }

    private static JFreeChart createBarChart(List<List<Object>> rowData, List<Object> headers) {
        DefaultCategoryDataset dataset = new DefaultCategoryDataset();
        String categoryLabel = headers.get(0).toString();
        String yLabel = headers.size() == 2 ? headers.get(1).toString() : "Value";
        String chartTitle = (headers.size() == 2)
            ? yLabel + " by " + categoryLabel
            : "Results";
        for (int i = 1; i < rowData.size(); i++) {
            Object category = rowData.get(i).get(0);
            for (int j = 1; j < headers.size(); j++) {
                Object value = rowData.get(i).get(j);
                String series = headers.get(j).toString();
                double v = parseDouble(value);
                dataset.addValue(v, series, category.toString());
            }
        }
        return ChartFactory.createBarChart(chartTitle, categoryLabel, yLabel, dataset);
    }

    private static JFreeChart createLineChart(List<List<Object>> rowData, List<Object> headers) {
        DefaultCategoryDataset dataset = new DefaultCategoryDataset();
        String categoryLabel = headers.get(0).toString();
        String yLabel = headers.size() == 2 ? headers.get(1).toString() : "Value";
        String chartTitle = (headers.size() == 2)
            ? yLabel + " by " + categoryLabel
            : "Results";
        for (int i = 1; i < rowData.size(); i++) {
            Object category = rowData.get(i).get(0);
            for (int j = 1; j < headers.size(); j++) {
                Object value = rowData.get(i).get(j);
                String series = headers.get(j).toString();
                double v = parseDouble(value);
                dataset.addValue(v, series, category.toString());
            }
        }
        return ChartFactory.createLineChart(chartTitle, categoryLabel, yLabel, dataset);
    }

    private static JFreeChart createPieChart(List<List<Object>> rowData, List<Object> headers) {
        DefaultPieDataset<String> dataset = new DefaultPieDataset<>();
        String categoryLabel = headers.get(0).toString();
        String valueLabel = headers.get(1).toString();
        String chartTitle = valueLabel + " by " + categoryLabel;
        for (int i = 1; i < rowData.size(); i++) {
            Object category = rowData.get(i).get(0);
            Object value = rowData.get(i).get(1);
            double v = parseDouble(value);
            dataset.setValue(category.toString(), v);
        }
        return ChartFactory.createPieChart(chartTitle, dataset);
    }

    private static double parseDouble(Object value) {
        if (value instanceof Number) return ((Number) value).doubleValue();
        try { return Double.parseDouble(value.toString()); } catch (Exception e) { return 0.0; }
    }
}
