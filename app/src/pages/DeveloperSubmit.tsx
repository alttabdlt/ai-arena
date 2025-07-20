import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Upload, Code, TrendingUp, Shield, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function DeveloperSubmit() {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    botName: '',
    description: '',
    strategy: '',
    riskLevel: '',
    expectedAPY: '',
    codeRepository: '',
    documentation: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Bot Submitted Successfully!",
      description: "Your trading bot will be reviewed within 48 hours.",
    });
    setFormData({
      botName: '',
      description: '',
      strategy: '',
      riskLevel: '',
      expectedAPY: '',
      codeRepository: '',
      documentation: ''
    });
  };

  const requirements = [
    "Open source code with MIT or Apache 2.0 license",
    "Comprehensive backtesting results (minimum 1 year)",
    "Risk management protocols implemented",
    "API documentation and integration guides",
    "Performance benchmarks vs major indices"
  ];

  return (
    <div className="min-h-screen bg-background">
      
      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center">
              <Code className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Submit Your Trading Bot
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Join the AI Investment Arena by submitting your trading algorithm. 
            Compete with other developers and earn from successful trades.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Submission Form */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Bot Submission Form
                </CardTitle>
                <CardDescription>
                  Provide details about your trading bot for review and integration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="botName">Bot Name</Label>
                      <Input
                        id="botName"
                        value={formData.botName}
                        onChange={(e) => setFormData({...formData, botName: e.target.value})}
                        placeholder="e.g., Quantum Momentum AI"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="strategy">Trading Strategy</Label>
                      <Select onValueChange={(value) => setFormData({...formData, strategy: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select strategy type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="momentum">Momentum Trading</SelectItem>
                          <SelectItem value="mean-reversion">Mean Reversion</SelectItem>
                          <SelectItem value="arbitrage">Arbitrage</SelectItem>
                          <SelectItem value="market-making">Market Making</SelectItem>
                          <SelectItem value="ml-based">Machine Learning</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      placeholder="Describe your bot's approach, methodology, and unique features..."
                      rows={4}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="riskLevel">Risk Level</Label>
                      <Select onValueChange={(value) => setFormData({...formData, riskLevel: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select risk level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="conservative">Conservative</SelectItem>
                          <SelectItem value="moderate">Moderate</SelectItem>
                          <SelectItem value="aggressive">Aggressive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="expectedAPY">Expected APY (%)</Label>
                      <Input
                        id="expectedAPY"
                        type="number"
                        value={formData.expectedAPY}
                        onChange={(e) => setFormData({...formData, expectedAPY: e.target.value})}
                        placeholder="e.g., 15"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="codeRepository">Code Repository URL</Label>
                    <Input
                      id="codeRepository"
                      type="url"
                      value={formData.codeRepository}
                      onChange={(e) => setFormData({...formData, codeRepository: e.target.value})}
                      placeholder="https://github.com/username/bot-repo"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="documentation">Documentation URL</Label>
                    <Input
                      id="documentation"
                      type="url"
                      value={formData.documentation}
                      onChange={(e) => setFormData({...formData, documentation: e.target.value})}
                      placeholder="Link to API docs, backtesting results, etc."
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full" size="lg">
                    Submit Bot for Review
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Requirements & Process */}
          <div className="space-y-6">
            {/* Requirements */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Requirements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {requirements.map((req, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{req}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Review Process */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Review Process
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Badge variant="outline">1</Badge>
                  <span className="text-sm">Code security audit</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline">2</Badge>
                  <span className="text-sm">Performance validation</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline">3</Badge>
                  <span className="text-sm">Risk assessment</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline">4</Badge>
                  <span className="text-sm">Integration testing</span>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline">5</Badge>
                  <span className="text-sm">Live deployment</span>
                </div>
              </CardContent>
            </Card>

            {/* Benefits */}
            <Card>
              <CardHeader>
                <CardTitle>Developer Benefits</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Revenue Share</span>
                  <Badge>70%</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Performance Bonus</span>
                  <Badge>Up to 5%</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Attribution</span>
                  <Badge>Full Credit</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}