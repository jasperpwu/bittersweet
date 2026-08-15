Pod::Spec.new do |s|
  s.name           = 'WidgetInfo'
  s.version        = '1.0.0'
  s.summary        = 'Authoritative installed home-screen widget detection'
  s.description    = 'Reports installed widget families via WidgetCenter.getCurrentConfigurations'
  s.author         = ''
  s.homepage       = 'https://github.com/'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.4'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
