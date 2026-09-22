( function ( wp ) {
	'use strict';

	var el = wp.element.createElement;
	var registerBlockType = wp.blocks.registerBlockType;
	var InspectorControls = wp.blockEditor.InspectorControls;
	var PanelBody = wp.components.PanelBody;
	var SelectControl = wp.components.SelectControl;
	var ToggleControl = wp.components.ToggleControl;
	var Placeholder = wp.components.Placeholder;
	var Button = wp.components.Button;
	var __ = wp.i18n.__;

	// Preloaded via wp_add_inline_script — no fetch-on-open needed.
	var TAB_SETS = ( window.wrtTabsBlockData && window.wrtTabsBlockData.tabSets ) || [];
	var MANAGE_URL = ( window.wrtTabsBlockData && window.wrtTabsBlockData.manageUrl ) || '#';
	var TYPE_LABELS = {
		2: __( 'Vertical', 'responsive-horizontal-vertical-and-accordion-tabs' ),
		4: __( 'Horizontal', 'responsive-horizontal-vertical-and-accordion-tabs' ),
		5: __( 'Accordion', 'responsive-horizontal-vertical-and-accordion-tabs' )
	};
	var ENGINE_LABELS = {
		modern: __( 'Modern', 'responsive-horizontal-vertical-and-accordion-tabs' ),
		legacy: __( 'Legacy', 'responsive-horizontal-vertical-and-accordion-tabs' )
	};

	function findTabSet( id ) {
		for ( var i = 0; i < TAB_SETS.length; i++ ) {
			if ( parseInt( TAB_SETS[ i ].id, 10 ) === parseInt( id, 10 ) ) {
				return TAB_SETS[ i ];
			}
		}
		return null;
	}

	function buildOptions() {
		var options = [
			{ value: 0, label: __( '— Select a tab set —', 'responsive-horizontal-vertical-and-accordion-tabs' ) }
		];
		TAB_SETS.forEach( function ( set ) {
			options.push( { value: set.id, label: set.name || ( '#' + set.id ) } );
		} );
		return options;
	}

	function badge( text ) {
		return el(
			'span',
			{
				style: {
					display: 'inline-block',
					background: '#f0f0f1',
					color: '#1e1e1e',
					borderRadius: '3px',
					padding: '2px 8px',
					fontSize: '12px',
					marginRight: '6px'
				}
			},
			text
		);
	}

	registerBlockType( 'wrt/responsive-tabs', {
		title: __( 'Responsive Tabs', 'responsive-horizontal-vertical-and-accordion-tabs' ),
		description: __( 'Display one of your responsive tab sets.', 'responsive-horizontal-vertical-and-accordion-tabs' ),
		icon: 'index-card',
		category: 'widgets',
		attributes: {
			tabsetId: { type: 'number', default: 0 },
			scroll: { type: 'boolean', default: true }
		},

		edit: function ( props ) {
			var attributes = props.attributes;
			var setAttributes = props.setAttributes;
			var tabSet = findTabSet( attributes.tabsetId );

			var inspector = el(
				InspectorControls,
				{},
				el(
					PanelBody,
					{ title: __( 'Tab Set', 'responsive-horizontal-vertical-and-accordion-tabs' ), initialOpen: true },
					el( SelectControl, {
						label: __( 'Choose a tab set', 'responsive-horizontal-vertical-and-accordion-tabs' ),
						value: attributes.tabsetId,
						options: buildOptions(),
						onChange: function ( value ) {
							setAttributes( { tabsetId: parseInt( value, 10 ) } );
						}
					} ),
					el( ToggleControl, {
						label: __( 'Smooth-scroll to opened tab (accordion/vertical)', 'responsive-horizontal-vertical-and-accordion-tabs' ),
						checked: !! attributes.scroll,
						onChange: function ( value ) {
							setAttributes( { scroll: value } );
						}
					} ),
					el(
						'p',
						{},
						el(
							'a',
							{ href: MANAGE_URL, target: '_blank', rel: 'noreferrer' },
							__( 'Manage tab sets', 'responsive-horizontal-vertical-and-accordion-tabs' )
						)
					)
				)
			);

			if ( ! tabSet ) {
				return el(
					wp.element.Fragment,
					{},
					inspector,
					el(
						Placeholder,
						{
							icon: 'index-card',
							label: __( 'Responsive Tabs', 'responsive-horizontal-vertical-and-accordion-tabs' ),
							instructions: TAB_SETS.length
								? __( 'Choose a tab set to display.', 'responsive-horizontal-vertical-and-accordion-tabs' )
								: __( 'You don\u2019t have any tab sets yet.', 'responsive-horizontal-vertical-and-accordion-tabs' )
						},
						TAB_SETS.length
							? el( SelectControl, {
									value: attributes.tabsetId,
									options: buildOptions(),
									onChange: function ( value ) {
										setAttributes( { tabsetId: parseInt( value, 10 ) } );
									}
							  } )
							: el(
									Button,
									{ variant: 'primary', href: MANAGE_URL, target: '_blank' },
									__( 'Create a tab set', 'responsive-horizontal-vertical-and-accordion-tabs' )
							  )
					)
				);
			}

			return el(
				wp.element.Fragment,
				{},
				inspector,
				el(
					'div',
					{
						style: {
							border: '1px solid #dcdcde',
							borderRadius: '4px',
							padding: '16px',
							background: '#fff'
						}
					},
					el(
						'div',
						{ style: { display: 'flex', alignItems: 'center', marginBottom: '8px' } },
						el( 'span', {
							className: 'dashicons dashicons-index-card',
							style: { fontSize: '22px', width: '22px', height: '22px', marginRight: '8px', color: '#2271b1' }
						} ),
						el( 'strong', {}, tabSet.name || ( '#' + tabSet.id ) )
					),
					el(
						'div',
						{ style: { marginBottom: '8px' } },
						badge( TYPE_LABELS[ tabSet.type ] || __( 'Unknown type', 'responsive-horizontal-vertical-and-accordion-tabs' ) ),
						tabSet.engine ? badge( ENGINE_LABELS[ tabSet.engine ] || tabSet.engine ) : null
					),
					el(
						'p',
						{ style: { color: '#50575e', fontStyle: 'italic', margin: '0 0 8px' } },
						__( 'Renders on the front end.', 'responsive-horizontal-vertical-and-accordion-tabs' )
					),
					el(
						'a',
						{ href: MANAGE_URL, target: '_blank', rel: 'noreferrer' },
						__( 'Edit this tab set', 'responsive-horizontal-vertical-and-accordion-tabs' )
					),
					el(
						'p',
						{ style: { marginTop: '12px', marginBottom: 0, fontSize: '12px', color: '#787c82' } },
						__( 'Want more styles and options? ', 'responsive-horizontal-vertical-and-accordion-tabs' ),
						el(
							'a',
							{ href: 'https://www.i13websolution.com/product/best-wordpress-responsive-tabs-plugin/', target: '_blank', rel: 'noreferrer' },
							__( 'Upgrade to Pro', 'responsive-horizontal-vertical-and-accordion-tabs' )
						)
					)
				)
			);
		},

		save: function () {
			// Server-rendered (render_callback) — nothing to save into post content.
			return null;
		}
	} );
} )( window.wp );
