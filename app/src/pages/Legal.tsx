import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@ui/tabs';
import { Shield, FileText, AlertTriangle, Scale } from 'lucide-react';

export default function Legal() {
  return (
    <div className="min-h-screen bg-background">
      
      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-primary rounded-full flex items-center justify-center">
              <Scale className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Legal Information
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Important legal documents and disclosures for AI Investment Arena platform users.
          </p>
        </div>

        <Tabs defaultValue="terms" className="space-y-8">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="terms">Terms of Service</TabsTrigger>
            <TabsTrigger value="privacy">Privacy Policy</TabsTrigger>
            <TabsTrigger value="disclaimers">Risk Disclaimers</TabsTrigger>
            <TabsTrigger value="compliance">Compliance</TabsTrigger>
          </TabsList>

          {/* Terms of Service */}
          <TabsContent value="terms">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Terms of Service
                </CardTitle>
                <CardDescription>
                  Last updated: January 2024
                </CardDescription>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none space-y-6">
                <section>
                  <h3 className="text-lg font-semibold mb-3">1. Acceptance of Terms</h3>
                  <p className="text-muted-foreground">
                    By accessing and using AI Investment Arena ("the Platform"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
                  </p>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3">2. Platform Description</h3>
                  <p className="text-muted-foreground">
                    AI Investment Arena is a platform that provides algorithmic trading services through artificial intelligence and machine learning technologies. The platform allows users to invest in various AI-powered trading strategies.
                  </p>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3">3. User Responsibilities</h3>
                  <ul className="list-disc list-inside text-muted-foreground space-y-2">
                    <li>Provide accurate and complete information during registration</li>
                    <li>Maintain the confidentiality of your account credentials</li>
                    <li>Comply with all applicable laws and regulations</li>
                    <li>Not engage in any fraudulent or manipulative activities</li>
                    <li>Understand the risks associated with algorithmic trading</li>
                  </ul>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3">4. Investment Risks</h3>
                  <p className="text-muted-foreground">
                    All investments carry risk, including the potential loss of principal. Past performance does not guarantee future results. Users should carefully consider their investment objectives and risk tolerance before investing.
                  </p>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3">5. Limitation of Liability</h3>
                  <p className="text-muted-foreground">
                    AI Investment Arena shall not be liable for any direct, indirect, incidental, special, or consequential damages resulting from the use or inability to use the platform or any trading losses incurred.
                  </p>
                </section>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Privacy Policy */}
          <TabsContent value="privacy">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Privacy Policy
                </CardTitle>
                <CardDescription>
                  How we collect, use, and protect your information
                </CardDescription>
              </CardHeader>
              <CardContent className="prose prose-sm max-w-none space-y-6">
                <section>
                  <h3 className="text-lg font-semibold mb-3">Information We Collect</h3>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium">Personal Information</h4>
                      <ul className="list-disc list-inside text-muted-foreground mt-2">
                        <li>Name, email address, and contact information</li>
                        <li>Financial information for investment purposes</li>
                        <li>Identity verification documents</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium">Usage Data</h4>
                      <ul className="list-disc list-inside text-muted-foreground mt-2">
                        <li>Platform interaction data and preferences</li>
                        <li>Trading activity and investment history</li>
                        <li>Device information and IP addresses</li>
                      </ul>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3">How We Use Your Information</h3>
                  <ul className="list-disc list-inside text-muted-foreground space-y-2">
                    <li>Provide and improve our trading services</li>
                    <li>Process investments and manage your account</li>
                    <li>Comply with legal and regulatory requirements</li>
                    <li>Communicate important updates and notifications</li>
                    <li>Detect and prevent fraud or unauthorized access</li>
                  </ul>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3">Data Protection</h3>
                  <p className="text-muted-foreground">
                    We implement industry-standard security measures to protect your personal and financial information. This includes encryption, secure servers, and regular security audits.
                  </p>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3">Third-Party Services</h3>
                  <p className="text-muted-foreground">
                    We may share information with trusted third-party service providers who assist in platform operations, always under strict confidentiality agreements and in compliance with privacy laws.
                  </p>
                </section>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Risk Disclaimers */}
          <TabsContent value="disclaimers">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Risk Disclaimers
                </CardTitle>
                <CardDescription>
                  Important risk disclosures for platform users
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="border-l-4 border-destructive bg-destructive/10 p-4 rounded">
                  <h4 className="font-semibold text-destructive mb-2">Investment Risk Warning</h4>
                  <p className="text-sm">
                    Trading in financial instruments involves substantial risk and may not be suitable for all investors. 
                    You could lose some or all of your invested capital.
                  </p>
                </div>

                <section>
                  <h3 className="text-lg font-semibold mb-3">Algorithmic Trading Risks</h3>
                  <ul className="list-disc list-inside text-muted-foreground space-y-2">
                    <li><strong>Technology Risk:</strong> System failures or connectivity issues may impact trading</li>
                    <li><strong>Market Risk:</strong> Algorithms may not perform as expected in volatile conditions</li>
                    <li><strong>Model Risk:</strong> AI models are based on historical data and may not predict future performance</li>
                    <li><strong>Liquidity Risk:</strong> Some strategies may face challenges in illiquid markets</li>
                  </ul>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3">Performance Disclaimers</h3>
                  <div className="bg-muted p-4 rounded space-y-2">
                    <p className="text-sm font-medium">Past performance is not indicative of future results.</p>
                    <p className="text-sm text-muted-foreground">
                      Simulated or backtested performance results have inherent limitations and may not reflect actual trading results.
                    </p>
                  </div>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3">Regulatory Notice</h3>
                  <p className="text-muted-foreground">
                    AI Investment Arena is not a registered investment advisor. The platform provides technology services 
                    and does not provide investment advice. Users should consult with qualified financial advisors before making investment decisions.
                  </p>
                </section>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Compliance */}
          <TabsContent value="compliance">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="h-5 w-5" />
                  Regulatory Compliance
                </CardTitle>
                <CardDescription>
                  Our commitment to regulatory standards and compliance
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <section>
                  <h3 className="text-lg font-semibold mb-3">Anti-Money Laundering (AML)</h3>
                  <p className="text-muted-foreground mb-3">
                    We maintain strict AML policies and procedures to prevent money laundering and terrorist financing.
                  </p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1">
                    <li>Customer identity verification (KYC) requirements</li>
                    <li>Transaction monitoring and reporting</li>
                    <li>Suspicious activity detection and reporting</li>
                  </ul>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3">Data Protection Compliance</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-2">GDPR Compliance</h4>
                      <p className="text-sm text-muted-foreground">
                        Full compliance with European General Data Protection Regulation for EU users.
                      </p>
                    </div>
                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-2">CCPA Compliance</h4>
                      <p className="text-sm text-muted-foreground">
                        California Consumer Privacy Act compliance for California residents.
                      </p>
                    </div>
                  </div>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3">Financial Regulations</h3>
                  <p className="text-muted-foreground">
                    We operate in compliance with applicable financial regulations and maintain appropriate licenses 
                    and registrations in jurisdictions where required.
                  </p>
                </section>

                <section>
                  <h3 className="text-lg font-semibold mb-3">Contact Compliance Team</h3>
                  <div className="bg-muted p-4 rounded">
                    <p className="text-sm">
                      For compliance-related questions or to report concerns:
                    </p>
                    <p className="text-sm font-medium mt-2">
                      Email: compliance@aiinvestmentarena.com
                    </p>
                  </div>
                </section>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}