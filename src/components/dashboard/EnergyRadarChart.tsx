import {
    Radar,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    ResponsiveContainer,
} from 'recharts';

interface EnergyData {
    category: string;
    score: number;
    fullMark: number;
}

interface EnergyRadarChartProps {
    data: EnergyData[];
}

export default function EnergyRadarChart({ data }: EnergyRadarChartProps) {
    return (
        <div className="w-full h-64 relative">
            {/* Background Glow */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-32 h-32 bg-brand-mint/10 rounded-full blur-3xl"></div>
            </div>
            
            <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
                    <PolarGrid stroke="rgba(255,255,255,0.1)" />
                    <PolarAngleAxis
                        dataKey="category"
                        tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 'bold' }}
                    />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar
                        name="Energy Score"
                        dataKey="score"
                        stroke="#10B981"
                        strokeWidth={2}
                        fill="#10B981"
                        fillOpacity={0.4}
                    />
                </RadarChart>
            </ResponsiveContainer>
        </div>
    );
}
