Pod::Spec.new do |s|
  s.name = 'FinancialAdvisorNative'
  s.version = '1.0.0'
  s.summary = 'Private on-device receipt OCR for FinancialAdvisor'
  s.description = 'Local Expo module; recognition runs through Apple Vision.'
  s.author = 'FinancialAdvisor'
  s.homepage = 'https://github.com/wacns/Financial-Advisor'
  s.license = { :type => 'MIT' }
  s.platforms = { :ios => '15.1' }
  s.source = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,mm,swift}'
  s.frameworks = 'Vision'
end
