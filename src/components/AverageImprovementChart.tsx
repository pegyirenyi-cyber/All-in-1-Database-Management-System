import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { StudentAssessment, AcademicCalendarConfig, ClassType, TermType } from '../types';
import { ArrowUpRight, ArrowDownRight, Minus, TrendingUp, Info } from 'lucide-react';

interface AverageImprovementChartProps {
  assessments: StudentAssessment[];
  calendar: AcademicCalendarConfig;
  assignedClasses: ClassType[];
}

interface ClassImprovementData {
  className: string;
  currentAvg: number | null;
  previousAvg: number | null;
  improvement: number | null;
  currentCount: number;
  previousCount: number;
}

export default function AverageImprovementChart({
  assessments,
  calendar,
  assignedClasses
}: AverageImprovementChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [chartMode, setChartMode] = useState<'comparison' | 'improvement'>('comparison');
  const [dimensions, setDimensions] = useState({ width: 600, height: 350 });

  // 1. Parse active and previous terms
  const prevTermAndYear = useMemo(() => {
    const activeTerm = calendar.activeTerm;
    const activeYear = calendar.activeAcademicYear;

    if (activeTerm === 'Term 3') {
      return { term: 'Term 2' as TermType, year: activeYear };
    } else if (activeTerm === 'Term 2') {
      return { term: 'Term 1' as TermType, year: activeYear };
    } else {
      // Term 1 -> Term 3 of previous year
      let prevYear: any = activeYear;
      if (activeYear.includes('/')) {
        const parts = activeYear.split('/');
        const start = parseInt(parts[0], 10);
        const end = parseInt(parts[1], 10);
        if (!isNaN(start) && !isNaN(end)) {
          prevYear = `${start - 1}/${end - 1}`;
        }
      } else if (activeYear.includes('-')) {
        const parts = activeYear.split('-');
        const start = parseInt(parts[0], 10);
        const end = parseInt(parts[1], 10);
        if (!isNaN(start) && !isNaN(end)) {
          prevYear = `${start - 1}-${end - 1}`;
        }
      } else {
        const yr = parseInt(activeYear, 10);
        if (!isNaN(yr)) {
          prevYear = String(yr - 1);
        }
      }
      return { term: 'Term 3' as TermType, year: prevYear as any };
    }
  }, [calendar]);

  // 2. Compute Improvement Data per class
  const data: ClassImprovementData[] = useMemo(() => {
    if (!assignedClasses || assignedClasses.length === 0) return [];

    return assignedClasses.map(cls => {
      const currentTermAssessments = assessments.filter(a => 
        a.class === cls && 
        a.academicYear === calendar.activeAcademicYear && 
        a.term === calendar.activeTerm
      );

      const prevTermAssessments = assessments.filter(a => 
        a.class === cls && 
        a.academicYear === prevTermAndYear.year && 
        a.term === prevTermAndYear.term
      );

      const currentAvg = currentTermAssessments.length > 0 
        ? Math.round(currentTermAssessments.reduce((sum, a) => sum + (a.totalScore || 0), 0) / currentTermAssessments.length * 10) / 10
        : null;

      const previousAvg = prevTermAssessments.length > 0 
        ? Math.round(prevTermAssessments.reduce((sum, a) => sum + (a.totalScore || 0), 0) / prevTermAssessments.length * 10) / 10
        : null;

      const improvement = (currentAvg !== null && previousAvg !== null) 
        ? Math.round((currentAvg - previousAvg) * 10) / 10
        : null;

      return {
        className: cls,
        currentAvg,
        previousAvg,
        improvement,
        currentCount: currentTermAssessments.length,
        previousCount: prevTermAssessments.length
      };
    });
  }, [assessments, calendar, assignedClasses, prevTermAndYear]);

  // 3. Monitor container size for responsiveness
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver(entries => {
      if (!entries || entries.length === 0) return;
      const { width } = entries[0].contentRect;
      const calculatedWidth = Math.max(width, 300);
      setDimensions({
        width: calculatedWidth,
        height: 320
      });
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // 4. Render D3 Chart
  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clear previous drawing

    const margin = { top: 30, right: 30, bottom: 50, left: 60 };
    const width = dimensions.width - margin.left - margin.right;
    const height = dimensions.height - margin.top - margin.bottom;

    const g = svg.append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Define X scale (Classes)
    const xScale = d3.scaleBand()
      .domain(data.map(d => d.className))
      .range([0, width])
      .padding(0.3);

    // Create Tooltip div in body
    d3.select('.d3-chart-tooltip').remove(); // avoid duplicates
    const tooltip = d3.select('body')
      .append('div')
      .attr('class', 'd3-chart-tooltip')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background-color', 'rgba(15, 23, 42, 0.95)')
      .style('color', '#fff')
      .style('padding', '8px 12px')
      .style('border-radius', '8px')
      .style('font-size', '11px')
      .style('font-family', 'ui-sans-serif, system-ui, sans-serif')
      .style('box-shadow', '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)')
      .style('border', '1px solid rgba(255, 255, 255, 0.1)')
      .style('z-index', '100')
      .style('pointer-events', 'none');

    if (chartMode === 'comparison') {
      // Side-by-side bar chart
      const yScale = d3.scaleLinear()
        .domain([0, 100])
        .nice()
        .range([height, 0]);

      // Sub-groups for Side-by-side
      const groupKey = 'className';
      const subgroups = ['previousAvg', 'currentAvg'];
      const xSubScale = d3.scaleBand()
        .domain(subgroups)
        .range([0, xScale.bandwidth()])
        .padding(0.05);

      // Grid lines
      g.append('g')
        .attr('class', 'grid-lines')
        .attr('stroke', '#f1f5f9')
        .attr('stroke-opacity', 0.8)
        .call(
          d3.axisLeft(yScale)
            .tickSize(-width)
            .tickFormat(() => '')
        )
        .selectAll('.tick line')
        .attr('stroke', '#f1f5f9');

      // Add X Axis
      g.append('g')
        .attr('transform', `translate(0, ${height})`)
        .call(d3.axisBottom(xScale).tickSize(5))
        .selectAll('text')
        .attr('fill', '#475569')
        .style('font-size', '11px')
        .style('font-weight', '600');

      // Add Y Axis
      g.append('g')
        .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => `${d}%`))
        .selectAll('text')
        .attr('fill', '#475569')
        .style('font-size', '11px');

      // Add groups for each class
      const classGroups = g.selectAll('.class-group')
        .data(data)
        .enter()
        .append('g')
        .attr('class', 'class-group')
        .attr('transform', d => `translate(${xScale(d.className)}, 0)`);

      // Draw Previous Term Bars
      classGroups.append('rect')
        .attr('x', xSubScale('previousAvg')!)
        .attr('y', height)
        .attr('width', xSubScale.bandwidth())
        .attr('height', 0)
        .attr('fill', '#94a3b8') // Cool gray
        .attr('rx', 4)
        .transition()
        .duration(800)
        .attr('y', d => yScale(d.previousAvg || 0))
        .attr('height', d => height - yScale(d.previousAvg || 0));

      // Draw Current Term Bars
      classGroups.append('rect')
        .attr('x', xSubScale('currentAvg')!)
        .attr('y', height)
        .attr('width', xSubScale.bandwidth())
        .attr('height', 0)
        .attr('fill', '#6366f1') // Indigo-500
        .attr('rx', 4)
        .transition()
        .duration(800)
        .delay(100)
        .attr('y', d => yScale(d.currentAvg || 0))
        .attr('height', d => height - yScale(d.currentAvg || 0));

      // Add interactive tooltips on groups
      classGroups.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', xScale.bandwidth())
        .attr('height', height)
        .attr('fill', 'transparent')
        .on('mouseover', function (event, d) {
          d3.select(this).style('cursor', 'pointer');
          tooltip.style('visibility', 'visible')
            .html(`
              <div class="space-y-1">
                <p class="font-extrabold text-amber-400 uppercase tracking-wider text-[10px] border-b border-slate-700 pb-0.5">Class: ${d.className}</p>
                <div class="flex items-center justify-between gap-4 font-mono text-[10px]">
                  <span class="text-slate-400">Previous (${prevTermAndYear.term}):</span>
                  <span class="text-white font-bold">${d.previousAvg !== null ? `${d.previousAvg}% (${d.previousCount} graded)` : 'No data'}</span>
                </div>
                <div class="flex items-center justify-between gap-4 font-mono text-[10px]">
                  <span class="text-indigo-300">Current (${calendar.activeTerm}):</span>
                  <span class="text-white font-bold">${d.currentAvg !== null ? `${d.currentAvg}% (${d.currentCount} graded)` : 'No data'}</span>
                </div>
                <div class="flex items-center justify-between gap-4 font-mono text-[10px] pt-0.5 border-t border-slate-800">
                  <span class="text-slate-400">Improvement:</span>
                  <span class="${(d.improvement || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'} font-black">
                    ${d.improvement !== null ? `${d.improvement >= 0 ? '+' : ''}${d.improvement}%` : 'N/A'}
                  </span>
                </div>
              </div>
            `);
        })
        .on('mousemove', function (event) {
          tooltip.style('top', `${event.pageY - 10}px`)
            .style('left', `${event.pageX + 15}px`);
        })
        .on('mouseout', function () {
          tooltip.style('visibility', 'hidden');
        });

    } else {
      // Divergence (Improvement) Chart
      const maxImp = d3.max(data, d => Math.abs(d.improvement || 0)) || 10;
      const limit = Math.ceil(maxImp / 5) * 5 + 5; // dynamic scaling with padding

      const yScale = d3.scaleLinear()
        .domain([-limit, limit])
        .range([height, 0]);

      // Grid lines
      g.append('g')
        .attr('class', 'grid-lines')
        .attr('stroke', '#f1f5f9')
        .attr('stroke-opacity', 0.8)
        .call(
          d3.axisLeft(yScale)
            .ticks(5)
            .tickSize(-width)
            .tickFormat(() => '')
        )
        .selectAll('.tick line')
        .attr('stroke', '#e2e8f0');

      // Add X Axis
      g.append('g')
        .attr('transform', `translate(0, ${yScale(0)})`) // horizontal baseline at 0
        .call(d3.axisBottom(xScale).tickSize(0))
        .selectAll('text')
        .attr('fill', '#475569')
        .style('font-weight', '600')
        .style('font-size', '11px')
        .attr('transform', d => {
          // Push labels to bottom if the bar is negative, else keep at 0 line or bottom
          return `translate(0, ${height - yScale(0) + 12})`;
        });

      // Add Y Axis
      g.append('g')
        .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => { const val = Number(d); return `${val > 0 ? '+' : ''}${val}%`; }))
        .selectAll('text')
        .attr('fill', '#475569')
        .style('font-size', '11px');

      // Draw Improvement Bars
      const bars = g.selectAll('.imp-bar')
        .data(data)
        .enter()
        .append('rect')
        .attr('class', 'imp-bar')
        .attr('x', d => xScale(d.className)!)
        .attr('width', xScale.bandwidth())
        .attr('y', yScale(0))
        .attr('height', 0)
        .attr('rx', 4)
        .attr('fill', d => {
          if (d.improvement === null) return '#cbd5e1';
          return d.improvement >= 0 ? '#10b981' : '#f43f5e'; // emerald green or rose red
        });

      bars.transition()
        .duration(800)
        .attr('y', d => {
          const val = d.improvement || 0;
          return val >= 0 ? yScale(val) : yScale(0);
        })
        .attr('height', d => {
          const val = d.improvement || 0;
          return Math.abs(yScale(val) - yScale(0));
        });

      // Add labels on top of/inside bars
      g.selectAll('.bar-label')
        .data(data)
        .enter()
        .append('text')
        .attr('class', 'bar-label')
        .attr('x', d => xScale(d.className)! + xScale.bandwidth() / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', d => {
          if (d.improvement === null) return '#64748b';
          return d.improvement >= 0 ? '#047857' : '#be123c';
        })
        .style('font-size', '11px')
        .style('font-weight', '800')
        .style('font-family', 'monospace')
        .attr('y', yScale(0))
        .transition()
        .duration(850)
        .attr('y', d => {
          const val = d.improvement || 0;
          if (val >= 0) {
            return yScale(val) - 6;
          } else {
            return yScale(val) + 14;
          }
        })
        .text(d => d.improvement !== null ? `${d.improvement >= 0 ? '+' : ''}${d.improvement}%` : 'N/A');

      // Interactive hover
      g.selectAll('.imp-trigger')
        .data(data)
        .enter()
        .append('rect')
        .attr('class', 'imp-trigger')
        .attr('x', d => xScale(d.className)!)
        .attr('y', 0)
        .attr('width', xScale.bandwidth())
        .attr('height', height)
        .attr('fill', 'transparent')
        .on('mouseover', function (event, d) {
          d3.select(this).style('cursor', 'pointer');
          tooltip.style('visibility', 'visible')
            .html(`
              <div class="space-y-1">
                <p class="font-extrabold text-amber-400 uppercase tracking-wider text-[10px] border-b border-slate-700 pb-0.5">Class: ${d.className}</p>
                <div class="flex items-center justify-between gap-4 font-mono text-[10px]">
                  <span class="text-slate-400">Previous Avg:</span>
                  <span class="text-white font-bold">${d.previousAvg !== null ? `${d.previousAvg}%` : 'No data'}</span>
                </div>
                <div class="flex items-center justify-between gap-4 font-mono text-[10px]">
                  <span class="text-slate-400">Current Avg:</span>
                  <span class="text-white font-bold">${d.currentAvg !== null ? `${d.currentAvg}%` : 'No data'}</span>
                </div>
                <div class="flex items-center justify-between gap-4 font-mono text-[10px] pt-0.5 border-t border-slate-800">
                  <span class="text-indigo-300">Term Improvement:</span>
                  <span class="${(d.improvement || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'} font-black">
                    ${d.improvement !== null ? `${d.improvement >= 0 ? '+' : ''}${d.improvement}%` : 'N/A'}
                  </span>
                </div>
              </div>
            `);
        })
        .on('mousemove', function (event) {
          tooltip.style('top', `${event.pageY - 10}px`)
            .style('left', `${event.pageX + 15}px`);
        })
        .on('mouseout', function () {
          tooltip.style('visibility', 'hidden');
        });
    }

    return () => {
      d3.select('.d3-chart-tooltip').remove();
    };
  }, [data, chartMode, dimensions, calendar, prevTermAndYear]);

  // If there are no classes assigned
  if (!assignedClasses || assignedClasses.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-slate-400 shadow-xs">
        <TrendingUp size={24} className="mx-auto text-slate-300 mb-2" />
        <p className="text-xs font-bold text-slate-700">No Assigned Classes Found</p>
        <p className="text-[11px] text-slate-500 font-sans mt-0.5">Improvement comparisons will display here once classes are assigned.</p>
      </div>
    );
  }

  // Count classes with actual calculations
  const classesWithData = data.filter(d => d.currentAvg !== null && d.previousAvg !== null);

  return (
    <div id="average-mark-improvement-section" className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      
      {/* Header Panel */}
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-linear-to-r from-slate-50 to-white">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-teal-50 text-teal-600 border border-teal-100 shadow-2xs">
            <TrendingUp size={18} />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              Average Mark Improvement per Class
              <span className="text-[10px] bg-teal-600 text-white font-mono px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">
                D3.js ENGINE
              </span>
            </h3>
            <p className="text-xs text-slate-500 font-sans">
              Comparing average final marks for <strong>{calendar.activeTerm}</strong> vs. previous <strong>{prevTermAndYear.term} ({prevTermAndYear.year})</strong>
            </p>
          </div>
        </div>

        {/* Chart Toggle View */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setChartMode('comparison')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              chartMode === 'comparison'
                ? 'bg-white text-indigo-600 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Side-by-Side</span>
          </button>
          <button
            type="button"
            onClick={() => setChartMode('improvement')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              chartMode === 'improvement'
                ? 'bg-white text-indigo-600 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Improvement Difference</span>
          </button>
        </div>
      </div>

      {/* Main Plot Container */}
      <div className="p-6">
        {classesWithData.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-3 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <Info size={28} className="mx-auto text-slate-400" />
            <div>
              <p className="text-xs font-bold text-slate-700">Awaiting Multi-Term Assessment Data</p>
              <p className="text-[11px] text-slate-500 max-w-md mx-auto font-sans leading-relaxed mt-1">
                This visualization tracks performance jumps across terms. Create assessments for students in the previous term 
                <strong> {prevTermAndYear.term} ({prevTermAndYear.year})</strong> and current term 
                <strong> {calendar.activeTerm} ({calendar.activeAcademicYear})</strong> to compare class trends.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Legend for active mode */}
            <div className="flex items-center justify-center gap-6 text-xs font-bold">
              {chartMode === 'comparison' ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded bg-slate-400 inline-block" />
                    <span className="text-slate-600 uppercase font-mono tracking-wider text-[10px]">
                      {prevTermAndYear.term} ({prevTermAndYear.year})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded bg-indigo-500 inline-block" />
                    <span className="text-indigo-600 uppercase font-mono tracking-wider text-[10px]">
                      {calendar.activeTerm} (Active)
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded bg-emerald-500 inline-block" />
                    <span className="text-emerald-600 uppercase font-mono tracking-wider text-[10px]">Positive Improvement</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 rounded bg-rose-500 inline-block" />
                    <span className="text-rose-600 uppercase font-mono tracking-wider text-[10px]">Declining Average</span>
                  </div>
                </>
              )}
            </div>

            {/* D3 Canvas container */}
            <div ref={containerRef} className="w-full overflow-hidden">
              <svg 
                ref={svgRef} 
                width={dimensions.width} 
                height={dimensions.height}
                className="mx-auto overflow-visible"
              />
            </div>

            {/* Dynamic Insight Badge / Callout cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
              {data.map(d => {
                if (d.currentAvg === null || d.previousAvg === null) return null;
                const isPositive = (d.improvement || 0) >= 0;

                return (
                  <div 
                    key={d.className}
                    className={`p-4 rounded-2xl border flex items-center justify-between gap-4 shadow-2xs ${
                      isPositive 
                        ? 'bg-emerald-50/50 border-emerald-100' 
                        : 'bg-rose-50/50 border-rose-100'
                    }`}
                  >
                    <div className="space-y-1">
                      <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">Class Stat</span>
                      <h4 className="text-sm font-black text-slate-800">{d.className} Class</h4>
                      <p className="text-[11.5px] text-slate-500 font-sans leading-none">
                        Avg: <span className="font-bold text-slate-700">{d.previousAvg}%</span> &rarr; <span className="font-bold text-slate-800">{d.currentAvg}%</span>
                      </p>
                    </div>

                    <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-mono font-black shadow-3xs ${
                      isPositive 
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                        : 'bg-rose-100 text-rose-800 border-rose-200'
                    }`}>
                      {isPositive ? (
                        <>
                          <ArrowUpRight size={15} strokeWidth={2.5} className="text-emerald-700 animate-pulse" />
                          <span>+{d.improvement}%</span>
                        </>
                      ) : (
                        <>
                          <ArrowDownRight size={15} strokeWidth={2.5} className="text-rose-700 animate-pulse" />
                          <span>{d.improvement}%</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        )}
      </div>

    </div>
  );
}
