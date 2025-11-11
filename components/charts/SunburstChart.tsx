'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3'
import { motion } from 'framer-motion'
import { Home, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ChartDataItem {
  name: string
  value: number
  children?: ChartDataItem[]
  color?: string
  description?: string
  metadata?: Record<string, any>
}

interface SunburstChartProps {
  title: string
  description?: string
  initialData: ChartDataItem[]
  onSliceClick?: (item: ChartDataItem, level: number) => Promise<ChartDataItem[]>
  colors?: string[]
}

// Phi color palette
const PHI_COLORS = [
  '#F2C166', // phi-gold
  '#1C8C63', // phi-mint
  '#A66C26', // phi-coral
  '#074259', // phi-dark
  '#4C566A', // phi-slate
  '#88C0D0', // light blue
  '#B48EAD', // purple
  '#EBCB8B', // yellow
]

export function SunburstChart({
  title,
  description,
  initialData,
  onSliceClick,
  colors = PHI_COLORS
}: SunburstChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [drilldownStack, setDrilldownStack] = useState<Array<{ name: string; data: ChartDataItem[] }>>([
    { name: title, data: initialData }
  ])
  const [isLoading, setIsLoading] = useState(false)

  // Convert flat data to hierarchical structure
  const convertToHierarchy = (data: ChartDataItem[]): any => {
    return {
      name: title,
      children: data.map(item => ({
        name: item.name,
        value: item.value,
        children: item.children,
        color: item.color,
        metadata: item.metadata
      }))
    }
  }

  const goBack = useCallback(() => {
    setDrilldownStack(prev => {
      if (prev.length > 1) {
        return prev.slice(0, -1)
      }
      return prev
    })
  }, [])

  const goHome = useCallback(() => {
    setDrilldownStack([{ name: title, data: initialData }])
  }, [title, initialData])

  // Create sunburst chart
  useEffect(() => {
    if (!svgRef.current) return

    const currentLevel = drilldownStack[drilldownStack.length - 1]
    const hierarchyData = convertToHierarchy(currentLevel.data)

    // Clear previous chart
    d3.select(svgRef.current).selectAll('*').remove()

    // Chart dimensions
    const width = 928
    const height = width
    const radius = width / 6

    // Create color scale
    const color = d3.scaleOrdinal<string>()
      .domain(hierarchyData.children?.map((d: any, i: number) => i.toString()) || [])
      .range(colors)

    // Compute the layout
    const hierarchy = d3.hierarchy(hierarchyData)
      .sum((d: any) => d.value || 0)
      .sort((a: any, b: any) => (b.value || 0) - (a.value || 0))

    const root = d3.partition()
      .size([2 * Math.PI, hierarchy.height + 1])
      (hierarchy)

    root.each((d: any) => d.current = d)

    // Create the arc generator
    const arc = d3.arc<any>()
      .startAngle((d: any) => d.x0)
      .endAngle((d: any) => d.x1)
      .padAngle((d: any) => Math.min((d.x1 - d.x0) / 2, 0.005))
      .padRadius(radius * 1.5)
      .innerRadius((d: any) => d.y0 * radius)
      .outerRadius((d: any) => Math.max(d.y0 * radius, d.y1 * radius - 1))

    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr('viewBox', [-width / 2, -height / 2, width, width])
      .style('font', '10px sans-serif')

    // Append arcs
    const path = svg.append('g')
      .selectAll('path')
      .data(root.descendants().slice(1))
      .join('path')
        .attr('fill', (d: any) => {
          let node = d
          while (node.depth > 1) node = node.parent
          return node.data.color || color(node.data.name) || colors[0]
        })
        .attr('fill-opacity', (d: any) => arcVisible(d.current) ? (d.children ? 0.6 : 0.4) : 0)
        .attr('pointer-events', (d: any) => arcVisible(d.current) ? 'auto' : 'none')
        .attr('d', (d: any) => arc(d.current))
        .style('cursor', (d: any) => d.children ? 'pointer' : 'default')
        .on('click', async (event: MouseEvent, p: any) => {
          if (!p.children) {
            // Try to load children if callback exists
            if (onSliceClick) {
              setIsLoading(true)
              try {
                const children = await onSliceClick(
                  { name: p.data.name, value: p.value || 0, metadata: p.data.metadata },
                  drilldownStack.length
                )
                if (children && children.length > 0) {
                  // Update drilldown stack with new level
                  setDrilldownStack([
                    ...drilldownStack,
                    { name: p.data.name, data: children }
                  ])
                }
              } catch (error) {
                console.error('Error loading drill-down data:', error)
              } finally {
                setIsLoading(false)
              }
            }
            return
          }
          clicked(event, root, p)
        })

    const format = d3.format(',d')

    // Add tooltips
    path.append('title')
      .text((d: any) => `${d.ancestors().map((d: any) => d.data.name).reverse().join('/')}\n₪${format(d.value || 0)}`)

    // Add labels
    const label = svg.append('g')
      .attr('pointer-events', 'none')
      .attr('text-anchor', 'middle')
      .style('user-select', 'none')
      .selectAll('text')
      .data(root.descendants().slice(1))
      .join('text')
        .attr('dy', '0.35em')
        .attr('fill-opacity', (d: any) => +labelVisible(d.current))
        .attr('transform', (d: any) => labelTransform(d.current))
        .text((d: any) => d.data.name)

    // Add parent circle for navigation
    const parent = svg.append('circle')
      .datum(root)
      .attr('r', radius)
      .attr('fill', 'none')
      .attr('pointer-events', 'all')
      .on('click', (event: MouseEvent) => {
        if (drilldownStack.length > 1) {
          goBack()
        }
      })

    // Handle zoom on click
    function clicked(event: MouseEvent, rootNode: any, p: any) {
      parent.datum(p.parent || rootNode)

      rootNode.each((d: any) => {
        d.target = {
          x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
          x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
          y0: Math.max(0, d.y0 - p.depth),
          y1: Math.max(0, d.y1 - p.depth)
        }
      })

      const duration = event.altKey ? 7500 : 750

      // Transition arcs
      path.transition()
        .duration(duration)
        .tween('data', (d: any) => {
          const i = d3.interpolate(d.current, d.target)
          return (t: number) => {
            d.current = i(t)
          }
        })
        .filter(function(d: any) {
          const element = this as SVGPathElement
          const opacity = element.getAttribute('fill-opacity')
          return opacity !== null ? +opacity > 0 : arcVisible(d.target)
        })
        .attr('fill-opacity', (d: any) => arcVisible(d.target) ? (d.children ? 0.6 : 0.4) : 0)
        .attr('pointer-events', (d: any) => arcVisible(d.target) ? 'auto' : 'none')
        .attrTween('d', (d: any) => () => arc(d.current) || '')

      // Transition labels
      label.filter(function(d: any) {
        const element = this as SVGTextElement
        const opacity = element.getAttribute('fill-opacity')
        return opacity !== null ? +opacity > 0 : labelVisible(d.target)
      }).transition()
        .duration(duration)
        .attr('fill-opacity', (d: any) => +labelVisible(d.target))
        .attrTween('transform', (d: any) => () => labelTransform(d.current) || '')
    }

    function arcVisible(d: any) {
      return d.y1 <= 3 && d.y0 >= 1 && d.x1 > d.x0
    }

    function labelVisible(d: any) {
      return d.y1 <= 3 && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.03
    }

    function labelTransform(d: any) {
      const x = (d.x0 + d.x1) / 2 * 180 / Math.PI
      const y = (d.y0 + d.y1) / 2 * radius
      return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`
    }

  }, [drilldownStack, colors, title, onSliceClick, initialData, goBack])

  const currentLevel = drilldownStack[drilldownStack.length - 1]
  const total = currentLevel.data.reduce((sum, item) => sum + item.value, 0)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white dark:bg-phi-dark border border-phi-gold/30 rounded-2xl p-6 shadow-lg"
    >
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-xl font-bold text-phi-dark dark:text-white mb-2 flex items-center gap-2">
          <span className="text-2xl" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
            ϕ
          </span>
          {title}
        </h3>
        {description && (
          <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
        )}
      </div>

      {/* Breadcrumbs */}
      {drilldownStack.length > 1 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            onClick={goHome}
            className="h-8 px-2 text-phi-gold hover:bg-phi-gold/10"
          >
            <Home className="w-4 h-4" />
          </Button>
          
          {drilldownStack.map((level, index) => (
            <div key={index} className="flex items-center gap-2">
              {index > 0 && (
                <ChevronRight className="w-4 h-4 text-gray-400" />
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (index < drilldownStack.length - 1) {
                    setDrilldownStack(drilldownStack.slice(0, index + 1))
                  }
                }}
                disabled={index === drilldownStack.length - 1}
                className={`h-8 px-3 text-sm ${
                  index === drilldownStack.length - 1
                    ? 'text-phi-dark dark:text-white font-semibold'
                    : 'text-phi-gold hover:bg-phi-gold/10'
                }`}
              >
                {level.name}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      {isLoading ? (
        <div className="h-[500px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-phi-gold"></div>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <svg ref={svgRef} className="w-full max-w-[928px] h-auto" />
          
          {/* Summary */}
          <div className="mt-6 pt-4 border-t border-phi-frost w-full">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400 text-sm">סה״כ ברמה זו:</span>
              <span className="text-2xl font-bold text-phi-dark dark:text-white">
                ₪{total.toLocaleString('he-IL')}
              </span>
            </div>
          </div>

          {/* Instruction */}
          <div className="mt-4 p-3 bg-phi-gold/10 dark:bg-phi-gold/5 rounded-lg w-full">
            <p className="text-sm text-phi-dark dark:text-white text-center">
              💡 לחץ על פרוסה בגרף כדי לראות פירוט מפורט יותר
            </p>
          </div>
        </div>
      )}
    </motion.div>
  )
}

